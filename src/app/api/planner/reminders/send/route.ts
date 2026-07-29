import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  renderReminderTemplate,
  selectReminderRecipients,
  type ReminderAudience,
} from '@/lib/planner-phase2'

interface ReminderValue {
  version: 1
  name: string
  subject: string
  body: string
  audience: ReminderAudience
  channel: 'email'
  lastError?: string | null
  recipientCount?: number
  lastSentAt?: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendEmail(input: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Email delivery is not configured.')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(input.text)}</div>`,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Email provider rejected the request (${response.status})${detail ? `: ${detail}` : ''}`)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { id?: unknown; dryRun?: unknown }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const dryRun = body.dryRun !== false
    if (!id) return NextResponse.json({ success: false, error: 'Reminder id is required.' }, { status: 400 })

    const reminder = await db.contentRevision.findFirst({
      where: { id, weddingId: access.context.weddingId, section: 'planner_reminder' },
    })
    if (!reminder) return NextResponse.json({ success: false, error: 'Reminder not found.' }, { status: 404 })
    if (reminder.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Cancelled reminders cannot be sent.' }, { status: 409 })
    }

    const value = JSON.parse(reminder.value) as ReminderValue
    const wedding = await db.wedding.findUnique({
      where: { id: access.context.weddingId },
      select: { title: true, date: true, slug: true },
    })
    if (!wedding) return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })

    const guests = await db.guest.findMany({
      where: { weddingId: access.context.weddingId },
      select: {
        id: true,
        name: true,
        email: true,
        rsvp: { select: { token: true, attending: true } },
      },
      orderBy: { name: 'asc' },
    })
    const recipients = selectReminderRecipients(guests, value.audience)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(wedding.date)

    const previews = recipients.slice(0, 20).map((recipient) => {
      const rsvpLink = recipient.token
        ? `${siteUrl || 'https://wewed.app'}/?rsvp=${encodeURIComponent(recipient.token)}`
        : `${siteUrl || 'https://wewed.app'}/#rsvp`
      const variables = {
        guest_name: recipient.name,
        wedding_title: wedding.title,
        wedding_date: dateLabel,
        rsvp_link: rsvpLink,
      }
      return {
        ...recipient,
        subject: renderReminderTemplate(value.subject, variables),
        body: renderReminderTemplate(value.body, variables),
      }
    })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        deliveryConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
        recipientCount: recipients.length,
        recipients: previews,
      })
    }

    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL, or use Preview.',
        },
        { status: 503 },
      )
    }

    let sent = 0
    const failures: Array<{ email: string; error: string }> = []
    for (let index = 0; index < recipients.length; index += 10) {
      const chunk = recipients.slice(index, index + 10)
      const results = await Promise.allSettled(
        chunk.map(async (recipient) => {
          const rsvpLink = recipient.token
            ? `${siteUrl || 'https://wewed.app'}/?rsvp=${encodeURIComponent(recipient.token)}`
            : `${siteUrl || 'https://wewed.app'}/#rsvp`
          const variables = {
            guest_name: recipient.name,
            wedding_title: wedding.title,
            wedding_date: dateLabel,
            rsvp_link: rsvpLink,
          }
          await sendEmail({
            to: recipient.email,
            subject: renderReminderTemplate(value.subject, variables),
            text: renderReminderTemplate(value.body, variables),
          })
          return recipient.email
        }),
      )

      results.forEach((result, resultIndex) => {
        if (result.status === 'fulfilled') sent += 1
        else {
          failures.push({
            email: chunk[resultIndex].email,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          })
        }
      })
    }

    const now = new Date()
    const nextValue: ReminderValue = {
      ...value,
      recipientCount: sent,
      lastSentAt: now.toISOString(),
      lastError: failures.length ? `${failures.length} delivery failures` : null,
    }
    await db.contentRevision.update({
      where: { id },
      data: {
        value: JSON.stringify(nextValue),
        status: failures.length && sent === 0 ? 'failed' : 'sent',
        publishedAt: now,
      },
    })
    await db.auditEvent.create({
      data: {
        action: 'reminder.send',
        resourceType: 'planner_reminder',
        resourceId: id,
        afterValue: JSON.stringify({ sent, failed: failures.length, audience: value.audience }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({
      success: true,
      dryRun: false,
      recipientCount: recipients.length,
      sent,
      failed: failures.length,
      failures: failures.slice(0, 20),
    })
  } catch (error) {
    console.error('[planner reminders send POST] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to send reminder.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
