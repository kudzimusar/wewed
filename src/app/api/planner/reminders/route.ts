import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import type { ReminderAudience } from '@/lib/planner-phase2'

const AUDIENCES: ReminderAudience[] = ['all', 'pending', 'attending', 'declined']
const STATUSES = ['draft', 'scheduled', 'sent', 'cancelled', 'failed'] as const

type ReminderStatus = (typeof STATUSES)[number]

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

function parseValue(raw: string): ReminderValue {
  const parsed = JSON.parse(raw) as Partial<ReminderValue>
  return {
    version: 1,
    name: typeof parsed.name === 'string' ? parsed.name : 'RSVP reminder',
    subject: typeof parsed.subject === 'string' ? parsed.subject : '',
    body: typeof parsed.body === 'string' ? parsed.body : '',
    audience: AUDIENCES.includes(parsed.audience as ReminderAudience)
      ? (parsed.audience as ReminderAudience)
      : 'pending',
    channel: 'email',
    lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    recipientCount: typeof parsed.recipientCount === 'number' ? parsed.recipientCount : 0,
    lastSentAt: typeof parsed.lastSentAt === 'string' ? parsed.lastSentAt : null,
  }
}

function serializeReminder(reminder: {
  id: string
  fieldKey: string
  value: string
  status: string
  scheduledFor: Date | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: reminder.id,
    fieldKey: reminder.fieldKey,
    status: reminder.status,
    scheduledFor: reminder.scheduledFor?.toISOString() ?? null,
    publishedAt: reminder.publishedAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
    ...parseValue(reminder.value),
  }
}

function validateInput(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
  const audience = AUDIENCES.includes(body.audience as ReminderAudience)
    ? (body.audience as ReminderAudience)
    : 'pending'
  const status = STATUSES.includes(body.status as ReminderStatus)
    ? (body.status as ReminderStatus)
    : body.scheduledFor
      ? 'scheduled'
      : 'draft'

  if (!name) throw new Error('Reminder name is required.')
  if (!subject) throw new Error('Email subject is required.')
  if (!messageBody) throw new Error('Reminder message is required.')

  let scheduledFor: Date | null = null
  if (typeof body.scheduledFor === 'string' && body.scheduledFor.trim()) {
    scheduledFor = new Date(body.scheduledFor)
    if (Number.isNaN(scheduledFor.getTime())) throw new Error('Invalid scheduled date.')
  }

  return {
    name,
    subject,
    body: messageBody,
    audience,
    status,
    scheduledFor,
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const reminders = await db.contentRevision.findMany({
      where: { weddingId: access.context.weddingId, section: 'planner_reminder' },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      deliveryConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      data: reminders.map(serializeReminder),
    })
  } catch (error) {
    console.error('[planner reminders GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load reminders.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const input = validateInput((await request.json()) as Record<string, unknown>)
    const reminder = await db.contentRevision.create({
      data: {
        section: 'planner_reminder',
        fieldKey: `reminder_${randomUUID().replace(/-/g, '')}`,
        value: JSON.stringify({
          version: 1,
          name: input.name,
          subject: input.subject,
          body: input.body,
          audience: input.audience,
          channel: 'email',
          lastError: null,
          recipientCount: 0,
          lastSentAt: null,
        } satisfies ReminderValue),
        status: input.status,
        scheduledFor: input.scheduledFor,
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
      },
    })

    await db.auditEvent.create({
      data: {
        action: 'reminder.create',
        resourceType: 'planner_reminder',
        resourceId: reminder.id,
        afterValue: reminder.value,
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, data: serializeReminder(reminder) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create reminder.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ success: false, error: 'Reminder id is required.' }, { status: 400 })

    const existing = await db.contentRevision.findFirst({
      where: { id, weddingId: access.context.weddingId, section: 'planner_reminder' },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Reminder not found.' }, { status: 404 })

    const current = parseValue(existing.value)
    const merged = validateInput({
      name: body.name ?? current.name,
      subject: body.subject ?? current.subject,
      body: body.body ?? current.body,
      audience: body.audience ?? current.audience,
      status: body.status ?? existing.status,
      scheduledFor:
        body.scheduledFor === undefined
          ? existing.scheduledFor?.toISOString() ?? ''
          : body.scheduledFor,
    })

    const updated = await db.contentRevision.update({
      where: { id },
      data: {
        value: JSON.stringify({
          ...current,
          name: merged.name,
          subject: merged.subject,
          body: merged.body,
          audience: merged.audience,
        } satisfies ReminderValue),
        status: merged.status,
        scheduledFor: merged.scheduledFor,
      },
    })

    await db.auditEvent.create({
      data: {
        action: 'reminder.update',
        resourceType: 'planner_reminder',
        resourceId: id,
        beforeValue: existing.value,
        afterValue: updated.value,
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, data: serializeReminder(updated) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update reminder.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { id?: unknown }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ success: false, error: 'Reminder id is required.' }, { status: 400 })

    const existing = await db.contentRevision.findFirst({
      where: { id, weddingId: access.context.weddingId, section: 'planner_reminder' },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Reminder not found.' }, { status: 404 })

    const updated = await db.contentRevision.update({
      where: { id },
      data: { status: 'cancelled', scheduledFor: null },
    })

    await db.auditEvent.create({
      data: {
        action: 'reminder.cancel',
        resourceType: 'planner_reminder',
        resourceId: id,
        beforeValue: existing.value,
        afterValue: updated.value,
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, data: serializeReminder(updated) })
  } catch (error) {
    console.error('[planner reminders DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to cancel reminder.' }, { status: 500 })
  }
}
