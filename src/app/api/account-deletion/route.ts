import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email/resend'
import { accountDeletionRequestEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1200) : ''
    const confirmed = body.confirmed === true

    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      return NextResponse.json({ success: false, error: 'Enter the email attached to the Wewed account.' }, { status: 400 })
    }
    if (!confirmed) {
      return NextResponse.json({ success: false, error: 'Confirm that you understand the effect of account deletion.' }, { status: 400 })
    }

    const session = readAppSession(request)
    if (session && session.email.trim().toLowerCase() !== email) {
      return NextResponse.json({ success: false, error: 'Use the email for the account currently signed in.' }, { status: 403 })
    }

    const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
         FROM wewed_admin."SupportCase"
        WHERE "category" = 'privacy_account_deletion'
          AND lower("requesterEmail") = $1
          AND "status" IN ('open', 'in_progress', 'waiting')
          AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY "createdAt" DESC
        LIMIT 1`,
      email,
    )

    const caseId = existing[0]?.id ?? randomUUID()
    if (!existing[0]) {
      const description = [
        session ? `Authenticated request from user ${session.userId}.` : 'Public web request; verify mailbox ownership before deletion.',
        reason ? `User note: ${reason}` : 'No optional reason provided.',
        'Requested scope: close the account and delete or anonymise associated personal data subject to shared-record, security and legal retention checks.',
      ].join('\n')

      await db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."SupportCase"
          ("id", "businessAccountId", "title", "description", "category", "priority", "status", "requesterEmail", "assignedToUserId")
         VALUES ($1, NULL, 'Account deletion request', $2, 'privacy_account_deletion', 'high', 'open', $3, NULL)`,
        caseId,
        description,
        email,
      )
    }

    const message = accountDeletionRequestEmail({ reference: caseId })
    await sendTransactionalEmail({
      idempotencyKey: `account-deletion-received:${caseId}`,
      category: 'account_deletion',
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      metadata: { supportCaseId: caseId },
      tags: [{ name: 'support_case_id', value: caseId }],
    }).catch((error) => {
      console.error('[account-deletion] acknowledgement email failed:', error)
    })

    return NextResponse.json({ success: true, reference: caseId })
  } catch (error) {
    console.error('[api/account-deletion] POST error:', error)
    return NextResponse.json({ success: false, error: 'Unable to submit the deletion request.' }, { status: 500 })
  }
}
