import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { APP_SESSION_COOKIE } from '@/lib/app-session'
import { WEDDING_GUEST_SESSION_COOKIE } from '@/lib/wedding-guest-session'
import { resolveWeddingAccessFromTokens } from '@/lib/wedding-public-access'

export async function GET(request: NextRequest) {
  const weddingSlug = request.nextUrl.searchParams.get('weddingSlug')?.trim()
  const invitationOnly = request.nextUrl.searchParams.get('invitationOnly') === '1'
  if (!weddingSlug) return NextResponse.json({ success: true, data: [] })

  const resolution = await resolveWeddingAccessFromTokens({
    slug: weddingSlug,
    appSessionToken: request.cookies.get(APP_SESSION_COOKIE)?.value ?? null,
    guestSessionToken: request.cookies.get(WEDDING_GUEST_SESSION_COOKIE)?.value ?? null,
  })
  if (!resolution.allowed || !resolution.wedding) return NextResponse.json({ success: true, data: [] })

  try {
    const now = new Date()
    const rows = await db.$queryRaw<Array<{
      id: string
      type: string
      title: string
      description: string | null
      targetAmount: string | null
      currency: string
      showTarget: boolean
      showRaised: boolean
      externalUrl: string | null
      ctaLabel: string | null
      invitationVisible: boolean
      showContributorRecognition: boolean
      publicNote: string | null
      raised: string
    }>>`
      SELECT camp.id, camp.type, camp.title, camp.description,
             camp.target_amount::text AS "targetAmount", camp.currency,
             camp.show_target AS "showTarget", camp.show_raised AS "showRaised",
             camp.external_url AS "externalUrl", camp.cta_label AS "ctaLabel",
             camp.invitation_visible AS "invitationVisible", camp.show_contributor_recognition AS "showContributorRecognition", camp.public_note AS "publicNote",
             COALESCE(SUM(CASE WHEN c.fulfillment_state IN ('RECEIVED','PAID_DIRECT','COMPLETED') AND c.currency = camp.currency THEN c.amount ELSE 0 END), 0)::text AS raised
        FROM wewed_contributions.campaigns camp
        LEFT JOIN wewed_contributions.wedding_contributions c ON c.campaign_id = camp.id
       WHERE camp.wedding_id = ${resolution.wedding.id}
         AND camp.published = TRUE
         AND (camp.publish_from IS NULL OR camp.publish_from <= ${now})
         AND (camp.publish_until IS NULL OR camp.publish_until >= ${now})
         AND (${invitationOnly} = FALSE OR camp.invitation_visible = TRUE)
       GROUP BY camp.id
       ORDER BY camp.created_at
    `
    const recognition = rows.some((row) => row.showContributorRecognition)
      ? await db.$queryRaw<Array<{ campaignId:string; displayName:string }>>`
          SELECT DISTINCT c.campaign_id AS "campaignId", p.display_name AS "displayName"
            FROM wewed_contributions.wedding_contributions c
            JOIN wewed_contributions.contributors p ON p.id=c.contributor_id AND p.wedding_id=c.wedding_id
            JOIN wewed_contributions.campaigns camp ON camp.id=c.campaign_id AND camp.wedding_id=c.wedding_id
           WHERE c.wedding_id=${resolution.wedding.id} AND camp.published=TRUE AND camp.show_contributor_recognition=TRUE
             AND p.public_recognition=TRUE AND p.anonymous_public=FALSE
             AND c.fulfillment_state IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')
           ORDER BY p.display_name
        `
      : []
    const data = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      currency: row.currency,
      targetAmount: row.showTarget && row.targetAmount !== null ? Number(row.targetAmount) : null,
      raised: row.showRaised ? Number(row.raised) : null,
      showTarget: row.showTarget,
      showRaised: row.showRaised,
      externalUrl: row.externalUrl,
      ctaLabel: row.ctaLabel,
      invitationVisible: row.invitationVisible,
      publicNote: row.publicNote,
      recognition: row.showContributorRecognition ? recognition.filter((item)=>item.campaignId===row.id).map((item)=>item.displayName) : [],
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[PUBLIC CONTRIBUTION CAMPAIGNS] error', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
