import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import { timelineMinutes } from '@/lib/planner-timeline-order'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import {
  NotebookConflictError,
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
  type NotebookSuggestion,
} from './types'

const TASK_CATEGORIES = [
  'timeline_12_18','timeline_9_12','timeline_6_9','timeline_3_6','timeline_2mo','timeline_1mo',
  'timeline_2wk','timeline_1wk','wedding_day','spiritual','venue','catering','attire','roora',
  'magumo','transport','stationery','decor','photo_video','music','other',
] as const
const TASK_PRIORITIES = ['low','medium','high'] as const
const BUDGET_CATEGORIES = [
  'venue','catering','attire','roora','decor','photo_video','music','transport','stationery','miscellaneous',
] as const

function text(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function weddingPermission(actor: NotebookActor, weddingId: string, permission: string): boolean {
  const wedding = actor.weddings.find((item) => item.id === weddingId && item.membershipStatus === 'active')
  return Boolean(wedding && (wedding.permissions.includes('*') || wedding.permissions.includes(permission)))
}

export async function applySuggestion(
  actor: NotebookActor,
  noteId: string,
  suggestionId: string,
): Promise<Record<string, unknown>> {
  const authorizedNote = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, authorizedNote)) throw new NotebookForbiddenError()

  let appliedTarget: { actionType: string; targetType: string; targetId: string | null } | null = null

  const result = await db.$transaction(async (tx) => {
    // Lock both the source note and the suggestion. This makes the source-version
    // check and the downstream canonical write one atomic operation, so a double
    // click or concurrent retry cannot create duplicate Tasks/Budget/Timeline rows.
    const noteRows = await tx.$queryRawUnsafe<Array<{
      version: number
      weddingId: string | null
      deletedAt: Date | null
      contentText: string
      title: string
    }>>(
      `SELECT version, "weddingId", "deletedAt", "contentText", title
         FROM wewed_notebook."NotebookNote"
        WHERE id=$1
        FOR SHARE`,
      noteId,
    )
    const lockedNote = noteRows[0]
    if (!lockedNote || lockedNote.deletedAt) throw new NotebookNotFoundError()
    if (!lockedNote.weddingId) throw new NotebookValidationError('This action requires a wedding-scoped note.')

    const suggestionRows = await tx.$queryRawUnsafe<NotebookSuggestion[]>(
      `SELECT * FROM wewed_notebook."NotebookSuggestion"
        WHERE id=$1 AND "noteId"=$2
        FOR UPDATE`,
      suggestionId,
      noteId,
    )
    const suggestion = suggestionRows[0]
    if (!suggestion) throw new NotebookNotFoundError('Notebook suggestion not found.')

    const receipts = await tx.$queryRawUnsafe<Array<{ result: Record<string, unknown> }>>(
      `SELECT result FROM wewed_notebook."NotebookActionReceipt" WHERE "suggestionId"=$1 LIMIT 1`,
      suggestionId,
    )
    if (receipts[0]) return { ...receipts[0].result, idempotentReplay: true }

    if (suggestion.sourceVersion !== lockedNote.version) {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_notebook."NotebookSuggestion"
            SET status='STALE', "updatedAt"=CURRENT_TIMESTAMP
          WHERE id=$1`,
        suggestionId,
      )
      throw new NotebookConflictError('This suggestion is stale because the source note changed. Re-run AI analysis.')
    }
    if (!['PENDING', 'FAILED', 'APPROVED'].includes(suggestion.status)) {
      throw new NotebookConflictError('This suggestion is no longer applicable.')
    }

    const payload = suggestion.payload ?? {}
    let actionResult: Record<string, unknown>
    let targetType = suggestion.targetType
    let targetId: string | null = null

    if (suggestion.actionType === 'CREATE_TASK') {
      if (!weddingPermission(actor, lockedNote.weddingId, 'planner.edit')) {
        throw new NotebookForbiddenError('Planner edit permission is required to create the suggested task.')
      }
      const titleError = plannerTitleError(payload.title)
      if (titleError) throw new NotebookValidationError(titleError)
      const categoryRaw = text(payload.category, 60)
      const category = TASK_CATEGORIES.includes(categoryRaw as (typeof TASK_CATEGORIES)[number]) ? categoryRaw : 'other'
      const priorityRaw = text(payload.priority, 20)
      const priority = TASK_PRIORITIES.includes(priorityRaw as (typeof TASK_PRIORITIES)[number]) ? priorityRaw : 'medium'
      let dueDate: Date | null = null
      if (payload.dueDate) {
        const parsed = new Date(String(payload.dueDate))
        if (Number.isNaN(parsed.getTime())) throw new NotebookValidationError('Suggested task due date is invalid.')
        dueDate = parsed
      }
      const last = await tx.plannerTask.findFirst({
        where: { weddingId: lockedNote.weddingId }, orderBy: { order: 'desc' }, select: { order: true },
      })
      const created = await tx.plannerTask.create({
        data: {
          title: normalizePlannerTitle(payload.title),
          description: text(payload.description, 5000) || null,
          category,
          status: 'todo',
          priority,
          dueDate,
          assignee: text(payload.assignee, 300) || null,
          order: (last?.order ?? 0) + 1,
          weddingId: lockedNote.weddingId,
        },
      })
      targetId = created.id
      actionResult = { action: 'CREATE_TASK', targetId, title: created.title }
    } else if (suggestion.actionType === 'CREATE_BUDGET_ITEM') {
      if (!weddingPermission(actor, lockedNote.weddingId, 'budget.edit')) {
        throw new NotebookForbiddenError('Budget edit permission is required to create the suggested item.')
      }
      const description = text(payload.description, 1000)
      if (!description) throw new NotebookValidationError('Budget description is required.')
      const estimatedCost = payload.estimatedCost
      if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
        throw new NotebookValidationError('Suggested budget amount must be an explicit non-negative number.')
      }
      if (
        !lockedNote.contentText.includes(String(estimatedCost)) &&
        !lockedNote.contentText.includes(estimatedCost.toLocaleString('en-US'))
      ) {
        throw new NotebookValidationError('The suggested amount is no longer explicitly supported by the source note.')
      }
      const categoryRaw = text(payload.category, 60)
      const category = BUDGET_CATEGORIES.includes(categoryRaw as (typeof BUDGET_CATEGORIES)[number])
        ? categoryRaw
        : 'miscellaneous'
      const currencyRaw = text(payload.currency, 8)
      const currency = /^[A-Za-z]{3,6}$/.test(currencyRaw) ? currencyRaw.toUpperCase() : 'USD'
      const created = await tx.budgetItem.create({
        data: {
          category,
          description,
          estimatedCost,
          actualCost: null,
          paidAmount: 0,
          currency,
          vendorId: null,
          vendorName: null,
          notes: text(payload.notes, 5000) || `Suggested from Notebook note: ${lockedNote.title}`,
          dueDate: null,
          weddingId: lockedNote.weddingId,
        },
      })
      targetId = created.id
      actionResult = { action: 'CREATE_BUDGET_ITEM', targetId, description, estimatedCost, currency }
    } else if (suggestion.actionType === 'CREATE_TIMELINE_EVENT') {
      if (!weddingPermission(actor, lockedNote.weddingId, 'timeline.edit')) {
        throw new NotebookForbiddenError('Timeline edit permission is required to create the suggested event.')
      }
      const time = text(payload.time, 80)
      const title = text(payload.title, 1000)
      if (!title) throw new NotebookValidationError('Timeline title is required.')
      if (!time || timelineMinutes(time) === null) {
        throw new NotebookValidationError('Timeline time must be a valid explicit clock time.')
      }
      if (!lockedNote.contentText.toLowerCase().includes(time.toLowerCase())) {
        throw new NotebookValidationError('The timeline time is no longer explicitly supported by the source note.')
      }
      const last = await tx.programmeItem.findFirst({
        where: { weddingId: lockedNote.weddingId }, orderBy: { order: 'desc' }, select: { order: true },
      })
      const created = await tx.programmeItem.create({
        data: {
          time,
          title,
          description: text(payload.description, 5000) || null,
          icon: null,
          duration: null,
          location: text(payload.location, 500) || null,
          displayIcon: null,
          order: (last?.order ?? 0) + 1,
          weddingId: lockedNote.weddingId,
        },
      })
      targetId = created.id
      actionResult = { action: 'CREATE_TIMELINE_EVENT', targetId, time, title }
    } else if (suggestion.actionType === 'DRAFT_COMMUNICATION') {
      const message = text(payload.message, 20_000)
      if (!message) throw new NotebookValidationError('Communication draft is empty.')
      targetType = 'COMMUNICATION_DRAFT'
      actionResult = {
        action: 'DRAFT_COMMUNICATION',
        audience: text(payload.audience, 500) || null,
        message,
        requiresSendReview: true,
      }
    } else {
      throw new NotebookValidationError('This suggestion is review-only and cannot mutate Wewed data.')
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookActionReceipt"
        (id, "suggestionId", "idempotencyKey", "targetType", "targetId", "actorUserId", result)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      randomUUID(),
      suggestion.id,
      suggestion.idempotencyKey,
      targetType,
      targetId,
      actor.session.userId,
      JSON.stringify(actionResult),
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookSuggestion"
          SET status='APPLIED', "reviewedByUserId"=$2, "reviewedAt"=CURRENT_TIMESTAMP,
              "appliedAt"=CURRENT_TIMESTAMP, "resultJson"=$3::jsonb,
              "failureCode"=NULL, "failureMessage"=NULL, "updatedAt"=CURRENT_TIMESTAMP
        WHERE id=$1`,
      suggestion.id,
      actor.session.userId,
      JSON.stringify(actionResult),
    )

    appliedTarget = { actionType: suggestion.actionType, targetType, targetId }
    return actionResult
  })

  if (appliedTarget) {
    await writeAudit(actor, noteId, 'SUGGESTION_APPLIED', {
      suggestionId,
      ...appliedTarget,
    })
  }
  return result
}

export async function applySuggestions(
  actor: NotebookActor,
  noteId: string,
  suggestionIds: string[],
): Promise<Array<{ suggestionId: string; ok: boolean; result?: Record<string, unknown>; error?: string }>> {
  const results = []
  for (const suggestionId of Array.from(new Set(suggestionIds)).slice(0, 30)) {
    try {
      const result = await applySuggestion(actor, noteId, suggestionId)
      results.push({ suggestionId, ok: true, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Suggestion failed.'
      await db.$executeRawUnsafe(
        `UPDATE wewed_notebook."NotebookSuggestion"
            SET status = CASE WHEN status='STALE' THEN status ELSE 'FAILED' END,
                "failureCode"=$2, "failureMessage"=$3, "updatedAt"=CURRENT_TIMESTAMP
          WHERE id=$1 AND status <> 'APPLIED'`,
        suggestionId,
        error instanceof NotebookConflictError ? 'STALE_OR_CONFLICT' : 'APPLY_FAILED',
        message.slice(0, 1000),
      )
      results.push({ suggestionId, ok: false, error: message })
    }
  }
  return results
}
