import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionId, listCampaigns } from '@/lib/contributions/store'
import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  try {
    return NextResponse.json({ success: true, data: await listCampaigns(access.context.weddingId) })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGNS GET] error', error)
    return NextResponse.json({ success: false, error: 'Could not load contribution campaigns.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const body = (await request.json()) as Record<string, unknown>
    const title = String(body.title ?? '').trim()
    if (!title) return NextResponse.json({ success: false, error: 'Campaign title is required.' }, { status: 400 })
    const externalUrl = String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\/\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    const id = contributionId()
    const currency = normalizeCurrency(body.currency)
    await db.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id, wedding_id, type, title, description, target_amount, currency, published, show_target, show_raised, external_url, cta_label, invitation_visible, public_note)
      VALUES
        (${id}, ${weddingId}, ${String(body.type ?? 'HONEYMOON')}, ${title}, ${String(body.description ?? '').trim() || null}, ${finiteNonNegative(body.targetAmount)}, ${currency}, ${Boolean(body.published)}, ${Boolean(body.showTarget)}, ${Boolean(body.showRaised)}, ${externalUrl}, ${String(body.ctaLabel ?? '').trim() || null}, ${Boolean(body.invitationVisible)}, ${String(body.publicNote ?? '').trim() || null})
    `
    const row = (await listCampaigns(weddingId)).find((item) => item.id === id)
    return NextResponse.json({ success: true, data: row ?? null }, { status: 201 })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGNS POST] error', error)
    return NextResponse.json({ success: false, error: 'Could not create the campaign.' }, { status: 500 })
  }
}
