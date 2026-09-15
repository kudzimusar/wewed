import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { APP_SESSION_COOKIE } from '@/lib/app-session'
import { CONTRIBUTION_TYPES, finiteNonNegative, normalizeCurrency, type ContributionType } from '@/lib/contributions'
import { contributionId } from '@/lib/contributions/store'
import { WEDDING_GUEST_SESSION_COOKIE } from '@/lib/wedding-guest-session'
import { resolveWeddingAccessFromTokens } from '@/lib/wedding-public-access'

interface RouteContext { params: Promise<{ id:string }> }
const CASH_TYPES=new Set<ContributionType>(['CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','HONEYMOON_GIFT'])
const IN_KIND_TYPES=new Set<ContributionType>(['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'])

export async function POST(request: NextRequest, context: RouteContext) {
  const {id}=await context.params
  try {
    const body=(await request.json()) as Record<string,unknown>
    const slug=String(body.weddingSlug??'').trim()
    if(!slug)return NextResponse.json({success:false,error:'Wedding is required.'},{status:400})
    const resolution=await resolveWeddingAccessFromTokens({slug,appSessionToken:request.cookies.get(APP_SESSION_COOKIE)?.value??null,guestSessionToken:request.cookies.get(WEDDING_GUEST_SESSION_COOKIE)?.value??null})
    if(!resolution.allowed||!resolution.wedding)return NextResponse.json({success:false,error:'This contribution choice is not available.'},{status:404})
    const weddingId=resolution.wedding.id
    const settings=await db.$queryRaw<Array<{accepting:boolean}>>`SELECT accepting_contributions AS accepting FROM wewed_contributions.wedding_settings WHERE wedding_id=${weddingId} LIMIT 1`
    if(settings[0]?.accepting===false)return NextResponse.json({success:false,error:'This couple is not accepting contributions right now.'},{status:409})
    const rows=await db.$queryRaw<Array<{id:string;title:string;currency:string;acceptedTypes:unknown;budgetItemId:string|null;serviceEngagementId:string|null;serviceCurrency:string|null;vendorId:string|null}>>`
      SELECT camp.id,camp.title,camp.currency,camp.accepted_types AS "acceptedTypes",camp.budget_item_id AS "budgetItemId",camp.service_engagement_id AS "serviceEngagementId",se.currency AS "serviceCurrency",se."vendorId" AS "vendorId"
        FROM wewed_contributions.campaigns camp LEFT JOIN public."ServiceEngagement" se ON se.id=camp.service_engagement_id AND se."weddingId"=camp.wedding_id
       WHERE camp.id=${id} AND camp.wedding_id=${weddingId} AND camp.published=TRUE AND camp.enabled=TRUE
         AND (camp.publish_from IS NULL OR camp.publish_from<=NOW()) AND (camp.publish_until IS NULL OR camp.publish_until>=NOW()) LIMIT 1
    `
    const campaign=rows[0]; if(!campaign)return NextResponse.json({success:false,error:'This contribution choice is no longer available.'},{status:404})
    const type=String(body.type??'').trim().toUpperCase() as ContributionType
    const accepted=(Array.isArray(campaign.acceptedTypes)?campaign.acceptedTypes:CONTRIBUTION_TYPES).map(String)
    if(!CONTRIBUTION_TYPES.includes(type)||!accepted.includes(type))return NextResponse.json({success:false,error:'Choose one of the contribution types offered by the couple.'},{status:400})
    if(type==='DIRECT_VENDOR_PAYMENT'&&!campaign.serviceEngagementId)return NextResponse.json({success:false,error:'This choice is not connected to a vendor service yet.'},{status:409})
    if(type==='DIRECT_VENDOR_PAYMENT'&&campaign.serviceCurrency!==campaign.currency)return NextResponse.json({success:false,error:'The vendor service and campaign currencies do not match.'},{status:409})
    const amount=finiteNonNegative(body.amount), estimatedValue=finiteNonNegative(body.estimatedValue), quantity=finiteNonNegative(body.quantity)
    if(CASH_TYPES.has(type)&&(amount===null||amount<=0))return NextResponse.json({success:false,error:'Enter the amount you intend to contribute.'},{status:400})
    const displayName=String(body.displayName??resolution.guest?.name??'').trim()
    if(!displayName)return NextResponse.json({success:false,error:'Please enter your name.'},{status:400})
    const email=String(body.email??resolution.guest?.email??'').trim().toLowerCase()||null
    const phone=String(body.phone??'').trim()||null
    const note=String(body.note??'').trim()||null
    const recognition=String(body.recognition??'private')
    if(!['private','anonymous','public'].includes(recognition))return NextResponse.json({success:false,error:'Choose a valid recognition preference.'},{status:400})
    const guestId=resolution.guest?.id??null
    const contributionIdValue=contributionId(), now=new Date(), currency=normalizeCurrency(campaign.currency), route=type==='DIRECT_VENDOR_PAYMENT'?'DIRECT_TO_VENDOR':IN_KIND_TYPES.has(type)?'IN_KIND_TO_COUPLE':'TO_COUPLE'
    await db.$transaction(async(tx)=>{
      let contributorIdValue=''
      if(guestId){
        const existing=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE wedding_id=${weddingId} AND guest_id=${guestId} ORDER BY created_at LIMIT 1`
        contributorIdValue=existing[0]?.id??''
      }
      if(!contributorIdValue){
        contributorIdValue=contributionId()
        await tx.$executeRaw`INSERT INTO wewed_contributions.contributors (id,wedding_id,display_name,kind,email,phone,public_recognition,anonymous_public,guest_id,notes) VALUES (${contributorIdValue},${weddingId},${displayName},'individual',${email},${phone},${recognition==='public'},${recognition==='anonymous'},${guestId},${note})`
      } else {
        await tx.$executeRaw`UPDATE wewed_contributions.contributors SET display_name=${displayName},email=COALESCE(${email},email),phone=COALESCE(${phone},phone),public_recognition=${recognition==='public'},anonymous_public=${recognition==='anonymous'},updated_at=NOW() WHERE id=${contributorIdValue} AND wedding_id=${weddingId}`
      }
      await tx.$executeRaw`INSERT INTO wewed_contributions.wedding_contributions (id,wedding_id,contributor_id,campaign_id,vendor_id,service_engagement_id,type,title,description,amount,currency,estimated_value,estimated_value_currency,quantity,unit,route,commitment_state,fulfillment_state,verification_state,thank_you_state,pledged_at,notes,source) VALUES (${contributionIdValue},${weddingId},${contributorIdValue},${id},${campaign.vendorId},${campaign.serviceEngagementId},${type},${campaign.title},${note},${amount},${currency},${estimatedValue},${estimatedValue===null?null:currency},${quantity},${String(body.unit??'').trim()||null},${route},'PLEDGED','PENDING','UNVERIFIED','NOT_DUE',${now},${note},'guest_public_campaign')`
      if(campaign.budgetItemId){
        const allocatedValue=IN_KIND_TYPES.has(type)?estimatedValue:amount
        if((allocatedValue??0)>0)await tx.$executeRaw`INSERT INTO wewed_contributions.contribution_allocations (id,wedding_id,contribution_id,budget_item_id,amount,currency,allocation_kind,note) VALUES (${contributionId()},${weddingId},${contributionIdValue},${campaign.budgetItemId},${allocatedValue},${currency},${type==='DIRECT_VENDOR_PAYMENT'?'DIRECT_PAYMENT':IN_KIND_TYPES.has(type)?'IN_KIND':'CASH'},'Guest pledge destination configured by campaign')`
      }
      await tx.auditEvent.create({data:{weddingId,action:'contribution.guest_pledged',actorId:guestId??null,resourceType:'WeddingContribution',resourceId:contributionIdValue,afterValue:JSON.stringify({campaignId:id,type,recognition,budgetItemId:campaign.budgetItemId,serviceEngagementId:campaign.serviceEngagementId})}})
    })
    return NextResponse.json({success:true,data:{id:contributionIdValue,status:'PLEDGED',message:'Thank you. Your contribution has been shared with the couple and their planner.'}},{status:201})
  } catch(error){console.error('[PUBLIC CONTRIBUTION PLEDGE]',error);return NextResponse.json({success:false,error:'We could not record your contribution right now. Please try again.'},{status:500})}
}
