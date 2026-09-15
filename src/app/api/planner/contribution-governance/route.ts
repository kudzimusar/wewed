import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CONTRIBUTION_TYPES, finiteNonNegative, isCurrencyCode, normalizeContributionCampaignType, normalizeCurrency, type ContributionType } from '@/lib/contributions'
import { contributionId } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

const DEFAULT_TYPES = [...CONTRIBUTION_TYPES]

function acceptedTypes(value: unknown): ContributionType[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const unique = [...new Set(value.map((item) => String(item).trim().toUpperCase()))]
  return unique.every((item) => CONTRIBUTION_TYPES.includes(item as ContributionType)) ? unique as ContributionType[] : null
}

async function governance(weddingId: string) {
  const [settings, campaigns, budgetItems, engagements] = await Promise.all([
    db.$queryRaw<Array<{acceptingContributions:boolean;disabledMessage:string|null}>>`
      SELECT accepting_contributions AS "acceptingContributions", disabled_message AS "disabledMessage"
        FROM wewed_contributions.wedding_settings WHERE wedding_id=${weddingId} LIMIT 1
    `,
    db.$queryRaw<Array<{id:string;type:string;title:string;description:string|null;targetAmount:string|null;currency:string;published:boolean;enabled:boolean;sortOrder:number;acceptedTypes:unknown;budgetItemId:string|null;serviceEngagementId:string|null;showTarget:boolean;showRaised:boolean;invitationVisible:boolean;showContributorRecognition:boolean;externalUrl:string|null;ctaLabel:string|null;publicNote:string|null}>>`
      SELECT id,type,title,description,target_amount::text AS "targetAmount",currency,published,enabled,sort_order AS "sortOrder",accepted_types AS "acceptedTypes",budget_item_id AS "budgetItemId",service_engagement_id AS "serviceEngagementId",show_target AS "showTarget",show_raised AS "showRaised",invitation_visible AS "invitationVisible",show_contributor_recognition AS "showContributorRecognition",external_url AS "externalUrl",cta_label AS "ctaLabel",public_note AS "publicNote"
        FROM wewed_contributions.campaigns WHERE wedding_id=${weddingId}
       ORDER BY sort_order ASC, created_at ASC
    `,
    db.budgetItem.findMany({where:{weddingId},select:{id:true,description:true,category:true,currency:true,serviceEngagementId:true},orderBy:[{category:'asc'},{description:'asc'}]}),
    db.serviceEngagement.findMany({where:{weddingId},select:{id:true,serviceCategory:true,serviceDescription:true,currency:true,vendor:{select:{id:true,name:true}}},orderBy:{createdAt:'desc'}}),
  ])
  return {
    settings: settings[0] ?? { acceptingContributions: true, disabledMessage: null },
    campaigns: campaigns.map((row) => ({...row,targetAmount:row.targetAmount === null ? null : Number(row.targetAmount),acceptedTypes:Array.isArray(row.acceptedTypes) ? row.acceptedTypes : DEFAULT_TYPES})),
    options:{budgetItems,engagements},
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request,'budget.view')
  if (access.error) return access.error
  try { return NextResponse.json({success:true,...await governance(access.context.weddingId)}) }
  catch (error) { console.error('[CONTRIBUTION GOVERNANCE GET]',error); return NextResponse.json({success:false,error:'Could not load contribution settings.'},{status:500}) }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request,'budget.edit')
  if (access.error) return access.error
  const weddingId=access.context.weddingId, actorId=access.context.session.userId
  try {
    const body=(await request.json()) as Record<string,unknown>
    const title=String(body.title??'').trim(); if(!title) return NextResponse.json({success:false,error:'Campaign title is required.'},{status:400})
    const type=normalizeContributionCampaignType(body.type??'HONEYMOON'); if(!type) return NextResponse.json({success:false,error:'Choose a valid campaign type.'},{status:400})
    const types=acceptedTypes(body.acceptedTypes??DEFAULT_TYPES); if(!types) return NextResponse.json({success:false,error:'Choose at least one valid contribution type.'},{status:400})
    const currency=normalizeCurrency(body.currency); if(body.currency!==undefined&&!isCurrencyCode(body.currency)) return NextResponse.json({success:false,error:'Use a three-letter currency code.'},{status:400})
    const target=finiteNonNegative(body.targetAmount); if(body.targetAmount!==undefined&&body.targetAmount!==null&&body.targetAmount!==''&&target===null) return NextResponse.json({success:false,error:'Target amount must be zero or more.'},{status:400})
    const budgetItemId=String(body.budgetItemId??'').trim()||null, serviceEngagementId=String(body.serviceEngagementId??'').trim()||null
    if(budgetItemId&&!await db.budgetItem.findFirst({where:{id:budgetItemId,weddingId},select:{id:true}})) return NextResponse.json({success:false,error:'Budget item does not belong to this wedding.'},{status:400})
    const engagement=serviceEngagementId?await db.serviceEngagement.findFirst({where:{id:serviceEngagementId,weddingId},select:{id:true,currency:true}}):null
    if(serviceEngagementId&&!engagement) return NextResponse.json({success:false,error:'Vendor service does not belong to this wedding.'},{status:400})
    if(types.includes('DIRECT_VENDOR_PAYMENT')&&!serviceEngagementId) return NextResponse.json({success:false,error:'Direct vendor payment requires a campaign vendor service.'},{status:400})
    if(engagement&&types.includes('DIRECT_VENDOR_PAYMENT')&&engagement.currency!==currency) return NextResponse.json({success:false,error:'Direct vendor campaign currency must match the vendor service.'},{status:400})
    const maxRows=await db.$queryRaw<Array<{max:number|null}>>`SELECT MAX(sort_order) AS max FROM wewed_contributions.campaigns WHERE wedding_id=${weddingId}`
    const id=contributionId(), sortOrder=Number(body.sortOrder??((maxRows[0]?.max??-1)+1)), typesJson=JSON.stringify(types)
    await db.$transaction(async(tx)=>{
      await tx.$executeRaw`INSERT INTO wewed_contributions.campaigns (id,wedding_id,type,title,description,target_amount,currency,published,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id,show_target,show_raised,external_url,cta_label,invitation_visible,show_contributor_recognition,public_note) VALUES (${id},${weddingId},${type},${title},${String(body.description??'').trim()||null},${target},${currency},${body.published===true},${body.enabled!==false},${sortOrder},${typesJson}::jsonb,${budgetItemId},${serviceEngagementId},${body.showTarget===true},${body.showRaised===true},${String(body.externalUrl??'').trim()||null},${String(body.ctaLabel??'').trim()||null},${body.invitationVisible!==false},${body.showContributorRecognition===true},${String(body.publicNote??'').trim()||null})`
      await tx.auditEvent.create({data:{weddingId,action:'contribution_campaign.created',actorId,resourceType:'ContributionCampaign',resourceId:id,afterValue:JSON.stringify({acceptedTypes:types,budgetItemId,serviceEngagementId})}})
    })
    return NextResponse.json({success:true,id,...await governance(weddingId)},{status:201})
  } catch(error){console.error('[CONTRIBUTION GOVERNANCE POST]',error);return NextResponse.json({success:false,error:'Could not create contribution choice.'},{status:500})}
}

export async function PATCH(request: NextRequest) {
  const access=await requireWeddingPermission(request,'budget.edit'); if(access.error)return access.error
  const weddingId=access.context.weddingId, actorId=access.context.session.userId
  try{
    const body=(await request.json()) as Record<string,unknown>
    if(body.scope==='settings'){
      if(typeof body.acceptingContributions!=='boolean') return NextResponse.json({success:false,error:'Accept Contributions must be on or off.'},{status:400})
      const disabledMessage=String(body.disabledMessage??'').trim()||null
      await db.$transaction(async(tx)=>{
        await tx.$executeRaw`INSERT INTO wewed_contributions.wedding_settings (wedding_id,accepting_contributions,disabled_message,updated_by_id) VALUES (${weddingId},${body.acceptingContributions},${disabledMessage},${actorId}) ON CONFLICT (wedding_id) DO UPDATE SET accepting_contributions=EXCLUDED.accepting_contributions,disabled_message=EXCLUDED.disabled_message,updated_by_id=EXCLUDED.updated_by_id,updated_at=NOW()`
        await tx.auditEvent.create({data:{weddingId,action:'contribution_settings.updated',actorId,resourceType:'ContributionSettings',resourceId:weddingId,afterValue:JSON.stringify({acceptingContributions:body.acceptingContributions})}})
      })
      return NextResponse.json({success:true,...await governance(weddingId)})
    }
    const id=String(body.id??'').trim(); if(!id)return NextResponse.json({success:false,error:'Campaign id is required.'},{status:400})
    const existing=await db.$queryRaw<Array<{id:string;currency:string}>>`SELECT id,currency FROM wewed_contributions.campaigns WHERE id=${id} AND wedding_id=${weddingId} LIMIT 1`
    if(!existing[0])return NextResponse.json({success:false,error:'Campaign not found.'},{status:404})
    const types=body.acceptedTypes===undefined?undefined:acceptedTypes(body.acceptedTypes); if(body.acceptedTypes!==undefined&&!types)return NextResponse.json({success:false,error:'Choose at least one valid contribution type.'},{status:400})
    const budgetItemId=body.budgetItemId===undefined?undefined:String(body.budgetItemId??'').trim()||null
    const serviceEngagementId=body.serviceEngagementId===undefined?undefined:String(body.serviceEngagementId??'').trim()||null
    if(budgetItemId&& !await db.budgetItem.findFirst({where:{id:budgetItemId,weddingId},select:{id:true}}))return NextResponse.json({success:false,error:'Budget item does not belong to this wedding.'},{status:400})
    const engagement=serviceEngagementId?await db.serviceEngagement.findFirst({where:{id:serviceEngagementId,weddingId},select:{id:true,currency:true}}):null
    if(serviceEngagementId&&!engagement)return NextResponse.json({success:false,error:'Vendor service does not belong to this wedding.'},{status:400})
    if(types?.includes('DIRECT_VENDOR_PAYMENT')&&serviceEngagementId===null)return NextResponse.json({success:false,error:'Direct vendor payment requires a campaign vendor service.'},{status:400})
    const typesJson=types?JSON.stringify(types):null
    await db.$transaction(async(tx)=>{
      await tx.$executeRaw`UPDATE wewed_contributions.campaigns SET enabled=CASE WHEN ${body.enabled!==undefined} THEN ${body.enabled===true} ELSE enabled END,sort_order=CASE WHEN ${body.sortOrder!==undefined} THEN ${Number(body.sortOrder)} ELSE sort_order END,accepted_types=CASE WHEN ${typesJson!==null} THEN ${typesJson}::jsonb ELSE accepted_types END,budget_item_id=CASE WHEN ${body.budgetItemId!==undefined} THEN ${budgetItemId??null} ELSE budget_item_id END,service_engagement_id=CASE WHEN ${body.serviceEngagementId!==undefined} THEN ${serviceEngagementId??null} ELSE service_engagement_id END,published=CASE WHEN ${body.published!==undefined} THEN ${body.published===true} ELSE published END,invitation_visible=CASE WHEN ${body.invitationVisible!==undefined} THEN ${body.invitationVisible===true} ELSE invitation_visible END,show_contributor_recognition=CASE WHEN ${body.showContributorRecognition!==undefined} THEN ${body.showContributorRecognition===true} ELSE show_contributor_recognition END,updated_at=NOW() WHERE id=${id} AND wedding_id=${weddingId}`
      await tx.auditEvent.create({data:{weddingId,action:'contribution_campaign.governance_updated',actorId,resourceType:'ContributionCampaign',resourceId:id,afterValue:JSON.stringify({fields:Object.keys(body)})}})
    })
    return NextResponse.json({success:true,...await governance(weddingId)})
  }catch(error){console.error('[CONTRIBUTION GOVERNANCE PATCH]',error);return NextResponse.json({success:false,error:'Could not update contribution settings.'},{status:500})}
}
