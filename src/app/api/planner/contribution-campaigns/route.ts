import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionId, listCampaigns } from '@/lib/contributions/store'
import { finiteNonNegative, isCurrencyCode, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'
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
  const actorId = access.context.session.userId
  try {
    const body = (await request.json()) as Record<string, unknown>
    const title = String(body.title ?? '').trim()
    if (!title) return NextResponse.json({ success: false, error: 'Campaign title is required.' }, { status: 400 })
    const type = normalizeContributionCampaignType(body.type ?? 'HONEYMOON')
    if (!type) return NextResponse.json({ success: false, error: 'Choose a valid contribution campaign type.' }, { status: 400 })
    const externalUrl = String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\/\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    const targetAmount = finiteNonNegative(body.targetAmount)
    if (body.targetAmount !== undefined && body.targetAmount !== null && body.targetAmount !== '' && targetAmount === null) return NextResponse.json({ success: false, error: 'Target amount must be zero or more.' }, { status: 400 })
    for (const field of ['published','showTarget','showRaised','invitationVisible','showContributorRecognition']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') return NextResponse.json({ success: false, error: `${field} must be true or false.` }, { status: 400 })
    }
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    const publishFrom = body.publishFrom ? new Date(String(body.publishFrom)) : null
    const publishUntil = body.publishUntil ? new Date(String(body.publishUntil)) : null
    if (publishFrom && Number.isNaN(publishFrom.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication start.' }, { status:400 })
    if (publishUntil && Number.isNaN(publishUntil.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication end.' }, { status:400 })
    if (publishFrom && publishUntil && publishUntil < publishFrom) return NextResponse.json({ success:false, error:'Publication end must be after its start.' }, { status:400 })
    const id = contributionId()
    const currency = normalizeCurrency(body.currency)
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO wewed_contributions.campaigns
          (id, wedding_id, type, title, description, target_amount, currency, published, show_target, show_raised, external_url, cta_label, invitation_visible, show_contributor_recognition, publish_from, publish_until, public_note)
        VALUES
          (${id}, ${weddingId}, ${type}, ${title}, ${String(body.description ?? '').trim() || null}, ${targetAmount}, ${currency}, ${Boolean(body.published)}, ${Boolean(body.showTarget)}, ${Boolean(body.showRaised)}, ${externalUrl}, ${String(body.ctaLabel ?? '').trim() || null}, ${Boolean(body.invitationVisible)}, ${Boolean(body.showContributorRecognition)}, ${publishFrom}, ${publishUntil}, ${String(body.publicNote ?? '').trim() || null})
      `
      await tx.auditEvent.create({ data: { weddingId, action: 'contribution_campaign.created', actorId, resourceType: 'ContributionCampaign', resourceId: id, afterValue: JSON.stringify({ type, published: Boolean(body.published), invitationVisible: Boolean(body.invitationVisible), currency })} })
    })
    const row = (await listCampaigns(weddingId)).find((item) => item.id === id)
    return NextResponse.json({ success: true, data: row ?? null }, { status: 201 })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGNS POST] error', error)
    return NextResponse.json({ success: false, error: 'Could not create the campaign.' }, { status: 500 })
  }
}
