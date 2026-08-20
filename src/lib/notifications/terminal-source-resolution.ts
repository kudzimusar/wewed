import { db } from '@/lib/db'

/**
 * Resolve every non-terminal notification bound to a business source once that
 * source itself becomes terminal. Date-window supersession remains owned by the
 * scheduler adapters; this function handles the stronger source lifecycle rule
 * regardless of which workflow originally created the notification.
 */
export async function resolveTerminalSourceNotifications(): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(
    `
      WITH resolved AS (
        UPDATE public."Notification" n
        SET state = 'resolved',
            "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
            "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
            "scheduledFor" = NULL,
            "snoozedUntil" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE n.state NOT IN ('resolved', 'cancelled', 'expired')
          AND (
            (n."sourceType" = 'planner_task' AND EXISTS (
              SELECT 1
              FROM public."PlannerTask" t
              WHERE t.id = n."sourceId"
                AND LOWER(t.status) IN ('done', 'completed')
            ))
            OR (n."sourceType" = 'budget_item' AND EXISTS (
              SELECT 1
              FROM public."BudgetItem" b
              WHERE b.id = n."sourceId"
                AND b."paidAmount" >= COALESCE(b."actualCost", b."estimatedCost")
            ))
            OR (n."sourceType" = 'service_engagement' AND EXISTS (
              SELECT 1
              FROM public."ServiceEngagement" se
              WHERE se.id = n."sourceId"
                AND LOWER(se."lifecycleStatus") IN ('completed', 'cancelled')
            ))
          )
        RETURNING 1
      )
      SELECT COUNT(*)::int AS count FROM resolved
    `,
  )

  await db.$executeRawUnsafe(
    `
      UPDATE public."Reminder" r
      SET state = 'cancelled',
          "cancelledAt" = COALESCE(r."cancelledAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE r.state = 'scheduled'
        AND r."sourceType" = 'notification'
        AND EXISTS (
          SELECT 1
          FROM public."Notification" n
          WHERE n.id = r."sourceId"
            AND n."recipientUserId" = r."recipientUserId"
            AND n.state IN ('resolved', 'cancelled', 'expired', 'dismissed')
        )
    `,
  )

  return Number(rows[0]?.count ?? 0)
}
