import { db } from '@/lib/db'
import {
  renderReminderTemplate,
  selectReminderRecipients,
  type ReminderAudience,
} from '@/lib/planner-phase2'

export interface StoredReminderValue {
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

export function reminderDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export async function deliverReminder(input: {
  reminderId: string
  weddingId: string
  actorId?: string | null
  dryRun: boolean
}) {
  const reminder = await db.contentRevision.findFirst({
    where: {
      id: input.reminderId,
      weddingId: input.weddingId,
      section: 'planner_reminder',
    },
  })
  if (!reminder) throw new Error('Reminder not found.')
  if (reminder.status === 'cancelled') throw new Error('Cancelled reminders cannot be sent.')

  const value = JSON.parse(reminder.value) as StoredReminderValue
  const wedding = await db.wedding.findUnique({
    where: { id: input.weddingId },
    select: { title: true, date: true },
  })
  if (!wedding) throw new Error('Wedding not found.')

  const guests = await db.guest.findMany({
    where: { weddingId: input.weddingId },
    select: {
      id: true,
      name: true,
      email: true,
      rsvp: { select: { token: true, attending: true } },
    },
    orderBy: { name: 'asc' },
  })
  const recipients = selectReminderRecipients(guests, value.audience)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.app').replace(/\/$/, '')
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(wedding.date)

  const renderFor = (recipient: (typeof recipients)[number]) => {
    const rsvpLink = recipient.token
      ? `${siteUrl}/?rsvp=${encodeURIComponent(recipient.token)}`
      : `${siteUrl}/#rsvp`
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
  }

  const previews = recipients.slice(0, 20).map(renderFor)
  if (input.dryRun) {
    return {
      dryRun: true as const,
      deliveryConfigured: reminderDeliveryConfigured(),
      recipientCount: recipients.length,
      recipients: previews,
    }
  }

  if (!reminderDeliveryConfigured()) throw new Error('Email delivery is not configured.')

  let sent = 0
  const failures: Array<{ email: string; error: string }> = []
  for (let index = 0; index < recipients.length; index += 10) {
    const chunk = recipients.slice(index, index + 10)
    const results = await Promise.allSettled(
      chunk.map(async (recipient) => {
        const rendered = renderFor(recipient)
        await sendEmail({ to: recipient.email, subject: rendered.subject, text: rendered.body })
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
  const nextValue: StoredReminderValue = {
    ...value,
    recipientCount: sent,
    lastSentAt: now.toISOString(),
    lastError: failures.length ? `${failures.length} delivery failures` : null,
  }
  await db.contentRevision.update({
    where: { id: reminder.id },
    data: {
      value: JSON.stringify(nextValue),
      status: failures.length && sent === 0 ? 'failed' : 'sent',
      publishedAt: now,
    },
  })
  await db.auditEvent.create({
    data: {
      action: input.actorId ? 'reminder.send' : 'reminder.auto_send',
      resourceType: 'planner_reminder',
      resourceId: reminder.id,
      afterValue: JSON.stringify({ sent, failed: failures.length, audience: value.audience }),
      weddingId: input.weddingId,
      actorId: input.actorId ?? null,
    },
  })

  return {
    dryRun: false as const,
    recipientCount: recipients.length,
    sent,
    failed: failures.length,
    failures: failures.slice(0, 20),
  }
}

export async function markReminderDeliveryFailure(reminderId: string, message: string) {
  const reminder = await db.contentRevision.findUnique({ where: { id: reminderId } })
  if (!reminder) return
  let value: StoredReminderValue
  try {
    value = JSON.parse(reminder.value) as StoredReminderValue
  } catch {
    return
  }
  await db.contentRevision.update({
    where: { id: reminderId },
    data: {
      status: 'failed',
      value: JSON.stringify({ ...value, lastError: message.slice(0, 500) }),
    },
  })
}
