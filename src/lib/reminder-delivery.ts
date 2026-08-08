import { db } from '@/lib/db'
import {
  buildDigitalInvitationUrl,
  normalizeInvitationCardStyle,
} from '@/lib/digital-invitation-card'
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

function safeColor(value: string | null | undefined, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback
}

function digitalInvitationEmailHtml(input: {
  guestName: string
  weddingTitle: string
  weddingDate: string
  venue: string
  invitationUrl: string
  invitationMessage: string | null
  body: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
}) {
  const primary = safeColor(input.primaryColor, '#BF9B5F')
  const accent = safeColor(input.accentColor, '#C0633F')
  const background = safeColor(input.backgroundColor, '#FBF6EE')
  const body = escapeHtml(input.body).replaceAll('\n', '<br />')
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f2eee7;padding:24px;font-family:Arial,sans-serif;color:#241d18">
    <div style="max-width:640px;margin:0 auto">
      <div style="background:${background};border:1px solid ${primary};border-radius:28px;padding:42px 28px;text-align:center;box-shadow:0 16px 45px rgba(36,29,24,.12)">
        <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${accent};font-weight:700">A private digital wedding invitation</div>
        <div style="margin:24px auto;width:58px;height:1px;background:${primary}"></div>
        <div style="font-family:Georgia,serif;font-size:42px;line-height:1.05;color:#241d18">${escapeHtml(input.weddingTitle)}</div>
        <div style="margin-top:18px;font-size:15px;color:#685f57">Especially for ${escapeHtml(input.guestName)}</div>
        ${input.invitationMessage ? `<div style="margin:24px auto 0;max-width:480px;font-family:Georgia,serif;font-size:18px;line-height:1.6;color:#4b433c">${escapeHtml(input.invitationMessage)}</div>` : ''}
        <div style="margin-top:28px;font-size:14px;line-height:1.7;color:#4b433c"><strong>${escapeHtml(input.weddingDate)}</strong><br />${escapeHtml(input.venue)}</div>
        <a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;margin-top:30px;background:${primary};color:#241d18;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">Open card &amp; RSVP</a>
        <div style="margin-top:20px;font-size:11px;line-height:1.5;color:#786f66">This invitation link is personal to you. Please do not forward it.</div>
      </div>
      <div style="margin:20px 8px 0;font-size:14px;line-height:1.65;color:#4b433c">${body}</div>
      <div style="margin-top:20px;text-align:center;font-size:11px;color:#8b8177">Securely delivered by Wewed</div>
    </div>
  </body>
</html>`
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
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
      html: input.html,
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
    select: {
      slug: true,
      title: true,
      date: true,
      venue: true,
      primaryColor: true,
      accentColor: true,
      backgroundColor: true,
      invitationCardStyle: true,
      invitationCardMessage: true,
    },
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
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.pro').replace(/\/$/, '')
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(wedding.date)
  const cardStyle = normalizeInvitationCardStyle(wedding.invitationCardStyle)

  const renderFor = (recipient: (typeof recipients)[number]) => {
    const invitationUrl = recipient.token
      ? buildDigitalInvitationUrl({
          siteUrl,
          weddingSlug: wedding.slug,
          token: recipient.token,
          style: cardStyle,
        })
      : `${siteUrl}/guest-access-help`
    const variables = {
      guest_name: recipient.name,
      wedding_title: wedding.title,
      wedding_date: dateLabel,
      rsvp_link: invitationUrl,
      digital_invitation_url: invitationUrl,
    }
    const subject = renderReminderTemplate(value.subject, variables)
    const body = renderReminderTemplate(value.body, variables)
    return {
      ...recipient,
      subject,
      body,
      invitationUrl,
      cardStyle,
      html: digitalInvitationEmailHtml({
        guestName: recipient.name,
        weddingTitle: wedding.title,
        weddingDate: dateLabel,
        venue: wedding.venue,
        invitationUrl,
        invitationMessage: wedding.invitationCardMessage,
        body,
        primaryColor: wedding.primaryColor,
        accentColor: wedding.accentColor,
        backgroundColor: wedding.backgroundColor,
      }),
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
        await sendEmail({
          to: recipient.email,
          subject: rendered.subject,
          text: rendered.body,
          html: rendered.html,
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
