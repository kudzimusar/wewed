import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  try {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId} LIMIT 1
    `
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : null
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const publicNote = typeof body.publicNote === 'string' ? body.publicNote.trim() || null : null
    const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim() || null : null
    const externalUrl = body.externalUrl === undefined ? null : String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\/\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    const targetAmount = body.targetAmount === undefined ? null : finiteNonNegative(body.targetAmount)
    const currency = body.currency === undefined ? null : normalizeCurrency(body.currency)
    const published = typeof body.published === 'boolean' ? body.published : null
    const showTarget = typeof body.showTarget === 'boolean' ? body.showTarget : null
    const showRaised = typeof body.showRaised === 'boolean' ? body.showRaised : null
    const invitationVisible = typeof body.invitationVisible === 'boolean' ? body.invitationVisible : null

    await db.$executeRaw`
      UPDATE wewed_contributions.campaigns
         SET title = COALESCE(${title}, title),
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
             updated_at = NOW()
       WHERE id = ${id} AND wedding_id = ${weddingId}
    `
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
  try {
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM wewed_contributions.wedding_contributions WHERE wedding_id = ${weddingId} AND campaign_id = ${id}
    `
    if (Number(rows[0]?.count ?? 0) > 0) return NextResponse.json({ success: false, error: 'Campaigns with recorded contributions should be unpublished rather than deleted.' }, { status: 409 })
    await db.$executeRaw`DELETE FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONTRIBUTION CAMPAIGN DELETE] error', error)
    return NextResponse.json({ success: false, error: 'Could not delete campaign.' }, { status: 500 })
  }
}
