import { NextRequest, NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai'
import { db } from '@/lib/db'
import { getContribution } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params:Promise<{id:string}> }

export async function POST(request:NextRequest, context:RouteContext) {
  const access=await requireWeddingPermission(request,'budget.view'); if(access.error)return access.error
  const {id}=await context.params; const weddingId=access.context.weddingId; const body=(await request.json()) as Record<string,unknown>; const action=String(body.action??'')
  if(!['draft-thank-you','draft-follow-up-task'].includes(action)) return NextResponse.json({success:false,error:'Choose a supported drafting action.'},{status:400})
  const contribution=await getContribution(weddingId,id); if(!contribution)return NextResponse.json({success:false,error:'Contribution not found.'},{status:404})
  const people=await db.$queryRaw<Array<{displayName:string;relationship:string|null}>>`SELECT p.display_name AS "displayName",p.relationship FROM wewed_contributions.wedding_contributions c JOIN wewed_contributions.contributors p ON p.id=c.contributor_id WHERE c.id=${id} AND c.wedding_id=${weddingId} LIMIT 1`
  const person=people[0]; const purpose=action==='draft-thank-you'?'a concise, warm thank-you note':'a concise Planner follow-up task title'
  const result=await generateAiText({ profile:'private', maxOutputTokens:220, messages:[{role:'system',content:'You assist a wedding planner. Draft text only. Never claim money was received, paid, verified, sent, or reconciled unless the supplied record explicitly says so. Never mutate data. Do not invent dates, amounts, vendors, promises, or evidence.'},{role:'user',content:`Draft ${purpose}. Contributor: ${person?.displayName??'Contributor'}. Relationship: ${person?.relationship??'not recorded'}. Contribution title: ${contribution.title}. Type: ${contribution.type}. Fulfillment: ${contribution.fulfillmentState}. Verification: ${contribution.verificationState}. Thank-you state: ${contribution.thankYouState}. Keep the wording appreciative and non-transactional.`}] })
  return NextResponse.json({success:true,data:{action,draft:result.text,provider:result.provider,model:result.model,requiresUserConfirmation:true,financialMutationPerformed:false}})
}
