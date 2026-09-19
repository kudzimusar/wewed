import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CONTRIBUTION_TYPES, type ContributionType } from '@/lib/contributions'
import { APP_SESSION_COOKIE } from '@/lib/app-session'
import { WEDDING_GUEST_SESSION_COOKIE } from '@/lib/wedding-guest-session'
import { resolveWeddingAccessFromTokens } from '@/lib/wedding-public-access'

export async function GET(request: NextRequest) {
  const weddingSlug = request.nextUrl.searchParams.get('weddingSlug')?.trim()
  const invitationOnly = request.nextUrl.searchParams.get('invitationOnly') === '1'
  if (!weddingSlug) return NextResponse.json({ success: true, acceptingContributions: false, disabledMessage: null, data: [] })

  const resolution = await resolveWeddingAccessFromTokens({
    slug: weddingSlug,
    appSessionToken: request.cookies.get(APP_SESSION_COOKIE)?.value ?? null,
    guestSessionToken: request.cookies.get(WEDDING_GUEST_SESSION_COOKIE)?.value ?? null,
  })
  if (!resolution.allowed || !resolution.wedding) return NextResponse.json({ success: true, acceptingContributions: false, disabledMessage: null, data: [] })

  try {
    const now = new Date()
    const settings = await db.$queryRaw<Array<{acceptingContributions:boolean;disabledMessage:string|null}>>`
      SELECT accepting_contributions AS "acceptingContributions", disabled_message AS "disabledMessage"
        FROM wewed_contributions.wedding_settings WHERE wedding_id=${resolution.wedding.id} LIMIT 1
    `
    const acceptingContributions = settings[0]?.acceptingContributions ?? true
    const disabledMessage = settings[0]?.disabledMessage ?? null
    const rows = await db.$queryRaw<Array<{
      id:string;type:string;title:string;description:string|null;targetAmount:string|null;currency:string;showTarget:boolean;showRaised:boolean;externalUrl:string|null;ctaLabel:string|null;invitationVisible:boolean;showContributorRecognition:boolean;publicNote:string|null;raised:string;acceptedTypes:unknown;budgetItemId:string|null;serviceEngagementId:string|null
    }>>`
      SELECT camp.id,camp.type,camp.title,camp.description,camp.target_amount::text AS "targetAmount",camp.currency,camp.show_target AS "showTarget",camp.show_raised AS "showRaised",camp.external_url AS "externalUrl",camp.cta_label AS "ctaLabel",camp.invitation_visible AS "invitationVisible",camp.show_contributor_recognition AS "showContributorRecognition",camp.public_note AS "publicNote",camp.accepted_types AS "acceptedTypes",camp.budget_item_id AS "budgetItemId",camp.service_engagement_id AS "serviceEngagementId",
             COALESCE(SUM(CASE WHEN c.fulfillment_state IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED') AND c.currency=camp.currency THEN c.amount ELSE 0 END),0)::text AS raised
        FROM wewed_contributions.campaigns camp
        LEFT JOIN wewed_contributions.wedding_contributions c ON c.campaign_id=camp.id
       WHERE camp.wedding_id=${resolution.wedding.id} AND camp.published=TRUE AND camp.enabled=TRUE
         AND (camp.publish_from IS NULL OR camp.publish_from<=${now}) AND (camp.publish_until IS NULL OR camp.publish_until>=${now})
         AND (${invitationOnly}=FALSE OR camp.invitation_visible=TRUE)
       GROUP BY camp.id
       ORDER BY camp.sort_order ASC,camp.created_at ASC
    `
    const recognition = rows.some((row)=>row.showContributorRecognition) ? await db.$queryRaw<Array<{campaignId:string;displayName:string}>>`
      SELECT DISTINCT c.campaign_id AS "campaignId",p.display_name AS "displayName"
        FROM wewed_contributions.wedding_contributions c
        JOIN wewed_contributions.contributors p ON p.id=c.contributor_id AND p.wedding_id=c.wedding_id
        JOIN wewed_contributions.campaigns camp ON camp.id=c.campaign_id AND camp.wedding_id=c.wedding_id
       WHERE c.wedding_id=${resolution.wedding.id} AND camp.published=TRUE AND camp.enabled=TRUE AND camp.show_contributor_recognition=TRUE
         AND p.public_recognition=TRUE AND p.anonymous_public=FALSE AND c.fulfillment_state IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')
       ORDER BY p.display_name
    ` : []
    const data=rows.map((row)=>{
      const configured=(Array.isArray(row.acceptedTypes)?row.acceptedTypes:CONTRIBUTION_TYPES).map(String).filter((value): value is ContributionType=>CONTRIBUTION_TYPES.includes(value as ContributionType))
      const acceptedTypes=configured.filter((value)=>value!=='DIRECT_VENDOR_PAYMENT'||Boolean(row.serviceEngagementId))
      return {id:row.id,type:row.type,title:row.title,description:row.description,currency:row.currency,targetAmount:row.showTarget&&row.targetAmount!==null?Number(row.targetAmount):null,raised:row.showRaised?Number(row.raised):null,showTarget:row.showTarget,showRaised:row.showRaised,externalUrl:row.externalUrl,ctaLabel:row.ctaLabel,invitationVisible:row.invitationVisible,publicNote:row.publicNote,acceptedTypes,budgetLinked:Boolean(row.budgetItemId),vendorServiceLinked:Boolean(row.serviceEngagementId),recognition:row.showContributorRecognition?recognition.filter((item)=>item.campaignId===row.id).map((item)=>item.displayName):[]}
    })
    return NextResponse.json({success:true,acceptingContributions,disabledMessage,data})
  } catch(error) {
    console.error('[PUBLIC CONTRIBUTION CAMPAIGNS] error',error)
    return NextResponse.json({success:true,acceptingContributions:false,disabledMessage:'Contribution information is temporarily unavailable.',data:[]})
  }
}
