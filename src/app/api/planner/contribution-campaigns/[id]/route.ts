import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finiteNonNegative, isCurrencyCode, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const rows = await db.$queryRaw<Array<{ id: string; currency: string }>>`SELECT id, currency FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : null
    const type = body.type === undefined ? null : normalizeContributionCampaignType(body.type)
    if (body.type !== undefined && !type) return NextResponse.json({ success:false, error:'Choose a valid contribution campaign type.' }, { status:400 })
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const publicNote = typeof body.publicNote === 'string' ? body.publicNote.trim() || null : null
    const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim() || null : null
    const externalUrl = body.externalUrl === undefined ? null : String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\/\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    const targetAmount = body.targetAmount === undefined ? null : finiteNonNegative(body.targetAmount)
    if (body.targetAmount !== undefined && body.targetAmount !== null && body.targetAmount !== '' && targetAmount === null) return NextResponse.json({ success: false, error: 'Target amount must be zero or more.' }, { status: 400 })
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    const currency = body.currency === undefined ? null : normalizeCurrency(body.currency)
    if (currency && currency !== rows[0].currency) {
      const attached = await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM wewed_contributions.wedding_contributions WHERE wedding_id = ${weddingId} AND campaign_id = ${id}`
      if (Number(attached[0]?.count ?? 0) > 0) return NextResponse.json({ success: false, error: 'Campaign currency cannot change after contributions are recorded. Create a separate campaign for another currency.' }, { status: 409 })
    }
    const published = typeof body.published === 'boolean' ? body.published : null
    const showTarget = typeof body.showTarget === 'boolean' ? body.showTarget : null
    const showRaised = typeof body.showRaised === 'boolean' ? body.showRaised : null
    const invitationVisible = typeof body.invitationVisible === 'boolean' ? body.invitationVisible : null
    const showContributorRecognition = typeof body.showContributorRecognition === 'boolean' ? body.showContributorRecognition : null
    const publishFrom = body.publishFrom === undefined ? undefined : body.publishFrom ? new Date(String(body.publishFrom)) : null
    const publishUntil = body.publishUntil === undefined ? undefined : body.publishUntil ? new Date(String(body.publishUntil)) : null
    if (publishFrom instanceof Date && Number.isNaN(publishFrom.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication start.' }, { status:400 })
    if (publishUntil instanceof Date && Number.isNaN(publishUntil.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication end.' }, { status:400 })
    if (publishFrom && publishUntil && publishUntil < publishFrom) return NextResponse.json({ success:false, error:'Publication end must be after its start.' }, { status:400 })
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE wewed_contributions.campaigns
           SET type = COALESCE(${type}, type),
             title = COALESCE(${title}, title),
               description = CASE WHEN ${body.description !== undefined} THEN ${description} ELSE description END,
               public_note = CASE WHEN ${body.publicNote !== undefined} THEN ${publicNote} ELSE public_note END,
               cta_label = CASE WHEN ${body.ctaLabel !== undefined} THEN ${ctaLabel} ELSE cta_label END,
               external_url = CASE WHEN ${body.externalUrl !== undefined} THEN ${externalUrl} ELSE external_url END,
               target_amount = CASE WHEN ${body.targetAmount !== undefined} THEN ${targetAmount} ELSE target_amount END,
               currency = COALESCE(${currency}, currency),
               published = COALESCE(${published}, published),
               show_target = COALESCE(${showTarget}, show_target),
               show_raised = COALESCE(${showRaised}, show_raised),
               invitation_visible = COALESCE(${invitationVisible}, invitation_visible),
             show_contributor_recognition = COALESCE(${showContributorRecognition}, show_contributor_recognition),
             publish_from = CASE WHEN ${body.publishFrom !== undefined} THEN ${publishFrom} ELSE publish_from END,
             publish_until = CASE WHEN ${body.publishUntil !== undefined} THEN ${publishUntil} ELSE publish_until END,
               updated_at = NOW()
         WHERE id = ${id} AND wedding_id = ${weddingId}
      `
      await tx.auditEvent.create({ data: { weddingId, action: 'contribution_campaign.updated', actorId, resourceType: 'ContributionCampaign', resourceId: id, afterValue: JSON.stringify({ fields: Object.keys(body) })} })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGN PATCH] error', error)
    return NextResponse.json({ success: false, error: 'Could not update campaign.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM wewed_contributions.wedding_contributions WHERE wedding_id = ${weddingId} AND campaign_id = ${id}`
    if (Number(rows[0]?.count ?? 0) > 0) return NextResponse.json({ success: false, error: 'Campaigns with recorded contributions should be unpublished rather than deleted.' }, { status: 409 })
    await db.$transaction(async (tx) => {
      const deleted = await tx.$executeRaw`DELETE FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId}`
      if (deleted > 0) await tx.auditEvent.create({ data: { weddingId, action: 'contribution_campaign.deleted_empty', actorId, resourceType: 'ContributionCampaign', resourceId: id} })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGN DELETE] error', error)
    return NextResponse.json({ success: false, error: 'Could not delete campaign.' }, { status: 500 })
  }
}
