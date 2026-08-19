import { NextRequest, NextResponse } from 'next/server'
import { loadContributionWorkspace } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  try {
    const workspace = await loadContributionWorkspace(access.context.weddingId)
    return NextResponse.json({
      success: true,
      guardrails: {
        unknownPayerIsNotCouple: true,
        pledgeIsNotCash: true,
        inKindIsNotCashPaid: true,
        noAutomaticFx: true,
        financialMutationRequiresConfirmation: true,
      },
      summaryByCurrency: workspace.summaryByCurrency,
      records: workspace.data.map((item) => ({
        id: item.id,
        contributor: item.contributor.displayName,
        title: item.title,
        type: item.type,
        amount: item.amount,
        currency: item.currency,
        estimatedValue: item.estimatedValue,
        estimatedValueCurrency: item.estimatedValueCurrency,
        commitmentState: item.commitmentState,
        fulfillmentState: item.fulfillmentState,
        thankYouState: item.thankYouState,
        allocatedAmount: item.allocatedAmount,
        availableAmount: item.availableAmount,
      })),
    })
  } catch (error) {
    console.error('[CONTRIBUTIONS AI CONTEXT] error', error)
    return NextResponse.json({ success: false, error: 'Contribution context is unavailable.' }, { status: 500 })
  }
}
