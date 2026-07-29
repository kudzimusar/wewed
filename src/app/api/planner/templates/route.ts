import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  BUILTIN_PLANNER_TEMPLATES,
  dateFromOffset,
  getBuiltinTemplate,
  normalizeTitle,
  type PlannerTemplateDefinition,
  type PlannerTemplateItem,
  type ReminderAudience,
} from '@/lib/planner-phase2'

function parseCustomTemplate(row: {
  id: string
  value: string
  weddingId: string
  authorId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const parsed = JSON.parse(row.value) as Omit<PlannerTemplateDefinition, 'id' | 'source'>
  return {
    ...parsed,
    id: row.id,
    source: 'wedding' as const,
    sourceWeddingId: row.weddingId,
    ownerId: row.authorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function dayDifference(date: Date | null, weddingDate: Date): number | undefined {
  if (!date) return undefined
  return Math.round((date.getTime() - weddingDate.getTime()) / 86_400_000)
}

function parseTimelineIcon(icon: string | null) {
  if (!icon?.startsWith('{')) return { duration: '', location: '' }
  try {
    const parsed = JSON.parse(icon) as { d?: string; l?: string }
    return { duration: parsed.d ?? '', location: parsed.l ?? '' }
  } catch {
    return { duration: '', location: '' }
  }
}

async function loadTemplate(
  weddingId: string,
  userId: string,
  templateId: string,
): Promise<PlannerTemplateDefinition | null> {
  const builtin = getBuiltinTemplate(templateId)
  if (builtin) return builtin
  const row = await db.contentRevision.findFirst({
    where: {
      id: templateId,
      section: 'planner_template',
      status: { not: 'archived' },
      OR: [{ weddingId }, { authorId: userId }],
    },
  })
  return row ? parseCustomTemplate(row) : null
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const custom = await db.contentRevision.findMany({
      where: {
        section: 'planner_template',
        status: { not: 'archived' },
        OR: [
          { weddingId: access.context.weddingId },
          { authorId: access.context.session.userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      success: true,
      data: [...BUILTIN_PLANNER_TEMPLATES, ...custom.map(parseCustomTemplate)],
    })
  } catch (error) {
    console.error('[planner templates GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load templates.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'apply'
    const weddingId = access.context.weddingId
    const userId = access.context.session.userId
    const wedding = await db.wedding.findUnique({
      where: { id: weddingId },
      select: { title: true, date: true },
    })
    if (!wedding) return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })

    if (action === 'save_current') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      if (!name) return NextResponse.json({ success: false, error: 'Template name is required.' }, { status: 400 })

      const [tasks, timeline, reminders] = await Promise.all([
        db.plannerTask.findMany({ where: { weddingId }, orderBy: { createdAt: 'asc' } }),
        db.programmeItem.findMany({ where: { weddingId }, orderBy: [{ order: 'asc' }, { time: 'asc' }] }),
        db.contentRevision.findMany({
          where: { weddingId, section: 'planner_reminder', status: { not: 'cancelled' } },
          orderBy: { createdAt: 'asc' },
        }),
      ])

      const items: PlannerTemplateItem[] = [
        ...tasks.map((task) => ({
          type: 'task' as const,
          title: task.title,
          description: task.description ?? undefined,
          category: task.category,
          priority: task.priority as 'low' | 'medium' | 'high',
          offsetDays: dayDifference(task.dueDate, wedding.date),
          assignee: task.assignee ?? undefined,
        })),
        ...timeline.map((item) => {
          const meta = parseTimelineIcon(item.icon)
          return {
            type: 'timeline' as const,
            title: item.title,
            description: item.description ?? undefined,
            time: item.time,
            duration: meta.duration,
            location: meta.location,
          }
        }),
        ...reminders.map((reminder) => {
          const value = JSON.parse(reminder.value) as {
            name?: string
            subject?: string
            body?: string
            audience?: ReminderAudience
          }
          return {
            type: 'reminder' as const,
            title: value.name || 'RSVP reminder',
            subject: value.subject || '',
            body: value.body || '',
            audience: value.audience || 'pending',
            offsetDays: dayDifference(reminder.scheduledFor, wedding.date),
          }
        }),
      ]

      const value: Omit<PlannerTemplateDefinition, 'id' | 'source'> = {
        name,
        description: description || `Saved from ${wedding.title}`,
        version: 1,
        items,
      }
      const created = await db.contentRevision.create({
        data: {
          section: 'planner_template',
          fieldKey: `template_${randomUUID().replace(/-/g, '')}`,
          value: JSON.stringify(value),
          status: 'active',
          weddingId,
          authorId: userId,
        },
      })
      await db.auditEvent.create({
        data: {
          action: 'template.create',
          resourceType: 'planner_template',
          resourceId: created.id,
          afterValue: created.value,
          weddingId,
          actorId: userId,
        },
      })
      return NextResponse.json({ success: true, data: parseCustomTemplate(created) }, { status: 201 })
    }

    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : ''
    if (!templateId) return NextResponse.json({ success: false, error: 'templateId is required.' }, { status: 400 })
    const template = await loadTemplate(weddingId, userId, templateId)
    if (!template) return NextResponse.json({ success: false, error: 'Template not found.' }, { status: 404 })

    const [existingTasks, existingTimeline, existingReminders] = await Promise.all([
      db.plannerTask.findMany({ where: { weddingId }, select: { title: true } }),
      db.programmeItem.findMany({ where: { weddingId }, select: { title: true, time: true } }),
      db.contentRevision.findMany({
        where: { weddingId, section: 'planner_reminder', status: { not: 'cancelled' } },
        select: { value: true, scheduledFor: true },
      }),
    ])

    const taskKeys = new Set(existingTasks.map((task) => normalizeTitle(task.title)))
    const timelineKeys = new Set(
      existingTimeline.map((item) => `${item.time}|${normalizeTitle(item.title)}`),
    )
    const reminderKeys = new Set(
      existingReminders.map((row) => {
        try {
          const value = JSON.parse(row.value) as { subject?: string; audience?: string }
          return `${normalizeTitle(value.subject || '')}|${value.audience || 'pending'}|${row.scheduledFor?.toISOString() || ''}`
        } catch {
          return row.value
        }
      }),
    )

    let tasksCreated = 0
    let timelineCreated = 0
    let remindersCreated = 0
    let duplicatesSkipped = 0

    await db.$transaction(async (tx) => {
      for (const item of template.items) {
        if (item.type === 'task') {
          const key = normalizeTitle(item.title)
          if (taskKeys.has(key)) {
            duplicatesSkipped += 1
            continue
          }
          await tx.plannerTask.create({
            data: {
              title: item.title.trim(),
              description: item.description?.trim() || null,
              category: item.category || 'other',
              priority: item.priority || 'medium',
              dueDate:
                typeof item.offsetDays === 'number'
                  ? dateFromOffset(wedding.date, item.offsetDays)
                  : null,
              assignee: item.assignee?.trim() || null,
              order: existingTasks.length + tasksCreated + 1,
              weddingId,
            },
          })
          taskKeys.add(key)
          tasksCreated += 1
          continue
        }

        if (item.type === 'timeline') {
          const time = item.time?.trim() || '09:00'
          const key = `${time}|${normalizeTitle(item.title)}`
          if (timelineKeys.has(key)) {
            duplicatesSkipped += 1
            continue
          }
          await tx.programmeItem.create({
            data: {
              time,
              title: item.title.trim(),
              description: item.description?.trim() || null,
              icon: JSON.stringify({ d: item.duration || '', l: item.location || '' }),
              order: existingTimeline.length + timelineCreated + 1,
              weddingId,
            },
          })
          timelineKeys.add(key)
          timelineCreated += 1
          continue
        }

        const scheduledFor =
          typeof item.offsetDays === 'number' ? dateFromOffset(wedding.date, item.offsetDays) : null
        const audience = item.audience || 'pending'
        const key = `${normalizeTitle(item.subject || item.title)}|${audience}|${scheduledFor?.toISOString() || ''}`
        if (reminderKeys.has(key)) {
          duplicatesSkipped += 1
          continue
        }
        await tx.contentRevision.create({
          data: {
            section: 'planner_reminder',
            fieldKey: `reminder_${randomUUID().replace(/-/g, '')}`,
            value: JSON.stringify({
              version: 1,
              name: item.title,
              subject: item.subject || item.title,
              body: item.body || '',
              audience,
              channel: 'email',
              lastError: null,
              recipientCount: 0,
              lastSentAt: null,
            }),
            status: scheduledFor ? 'scheduled' : 'draft',
            scheduledFor,
            weddingId,
            authorId: userId,
          },
        })
        reminderKeys.add(key)
        remindersCreated += 1
      }
    })

    const result = { tasksCreated, timelineCreated, remindersCreated, duplicatesSkipped }
    await db.auditEvent.create({
      data: {
        action: 'template.apply',
        resourceType: 'planner_template',
        resourceId: templateId,
        afterValue: JSON.stringify(result),
        weddingId,
        actorId: userId,
      },
    })

    return NextResponse.json({ success: true, template: template.name, result })
  } catch (error) {
    console.error('[planner templates POST] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to apply template.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { id?: unknown }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ success: false, error: 'Template id is required.' }, { status: 400 })
    const existing = await db.contentRevision.findFirst({
      where: {
        id,
        section: 'planner_template',
        OR: [
          { weddingId: access.context.weddingId },
          { authorId: access.context.session.userId },
        ],
      },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Custom template not found.' }, { status: 404 })
    await db.contentRevision.update({ where: { id }, data: { status: 'archived' } })
    return NextResponse.json({ success: true, data: { id, archived: true } })
  } catch (error) {
    console.error('[planner templates DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to archive template.' }, { status: 500 })
  }
}
