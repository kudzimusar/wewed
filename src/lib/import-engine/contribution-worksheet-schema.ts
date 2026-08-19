import type { ModuleSchema } from './types'
import { db } from '@/lib/db'
import { contributionId } from '@/lib/contributions/store'
import { CONTRIBUTION_TYPES, type ContributionType } from '@/lib/contributions'

const IMPORTABLE_TYPES = CONTRIBUTION_TYPES.filter((type) => type !== 'DIRECT_VENDOR_PAYMENT')
const IN_KIND = new Set(['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'])
const CASH = new Set(['CASH_TO_COUPLE','HONEYMOON_GIFT'])
const STATUS = ['PLEDGED','RECEIVED']

function clean(value:unknown):string { return value == null ? '' : String(value).replace(/\u0000/g,'').replace(/\r/g,'').trim() }
function number(value:unknown):number|null { const source=clean(value).replace(/[$€£¥₹,\s]/g,'').replace(/[A-Za-z]{3,6}$/g,''); if(!source)return null; const parsed=Number(source); return Number.isFinite(parsed)?parsed:null }
function date(value:unknown):Date|null { const source=clean(value); if(!source)return null; const parsed=new Date(source); return Number.isNaN(parsed.getTime())?null:parsed }
function iso(value:unknown):string { if(!value)return ''; const parsed=value instanceof Date?value:new Date(String(value)); return Number.isNaN(parsed.getTime())?'':parsed.toISOString().slice(0,10) }

const fields = [
  { key:'contributionId', label:'Contribution ID', required:false, type:'string' as const, description:'Internal ID. Existing rows only update descriptive fields; financial facts are not rewritten by import.' },
  { key:'contributorId', label:'Contributor ID', required:false, type:'string' as const, description:'Existing contributor ID, if known.' },
  { key:'contributorName', label:'Contributor Name', required:true, type:'string' as const, example:'Tariro Moyo' },
  { key:'contributorEmail', label:'Contributor Email', required:false, type:'email' as const, sensitive:true },
  { key:'relationship', label:'Relationship', required:false, type:'string' as const, example:'Bride aunt' },
  { key:'type', label:'Contribution Type', required:true, type:'enum' as const, allowedValues:IMPORTABLE_TYPES, example:'CASH_TO_COUPLE' },
  { key:'title', label:'Contribution', required:true, type:'string' as const, example:'Help with catering' },
  { key:'amount', label:'Amount', required:false, type:'currency' as const },
  { key:'currency', label:'Currency', required:true, type:'string' as const, example:'USD' },
  { key:'estimatedValue', label:'Estimated In-kind Value', required:false, type:'currency' as const },
  { key:'quantity', label:'Quantity', required:false, type:'number' as const },
  { key:'unit', label:'Unit', required:false, type:'string' as const, example:'hours' },
  { key:'status', label:'Status', required:true, type:'enum' as const, allowedValues:STATUS, example:'PLEDGED' },
  { key:'expectedDate', label:'Expected Date', required:false, type:'date' as const },
  { key:'notes', label:'Notes', required:false, type:'string' as const },
]

function rowToRecord(row:Record<string,string>) {
  return { contributionId:clean(row.contributionId)||null, contributorId:clean(row.contributorId)||null, contributorName:clean(row.contributorName), contributorEmail:clean(row.contributorEmail).toLowerCase()||null, relationship:clean(row.relationship)||null, type:clean(row.type) as ContributionType, title:clean(row.title), amount:number(row.amount), currency:clean(row.currency).toUpperCase(), estimatedValue:number(row.estimatedValue), quantity:number(row.quantity), unit:clean(row.unit)||null, status:clean(row.status), expectedAt:date(row.expectedDate), notes:clean(row.notes)||null }
}

function recordToRow(record:any):Record<string,string> {
  return { contributionId:record.id??'', contributorId:record.contributorId??'', contributorName:record.contributorName??'', contributorEmail:record.contributorEmail??'', relationship:record.relationship??'', type:record.type??'', title:record.title??'', amount:record.amount==null?'':String(record.amount), currency:record.currency??'USD', estimatedValue:record.estimatedValue==null?'':String(record.estimatedValue), quantity:record.quantity==null?'':String(record.quantity), unit:record.unit??'', status:record.commitmentState==='PLEDGED'&&record.fulfillmentState==='PENDING'?'PLEDGED':'RECEIVED', expectedDate:iso(record.expectedAt), notes:record.notes??'' }
}

function validateRow(row:Record<string,string>):string[] {
  const errors:string[]=[]; const type=clean(row.type) as ContributionType; const status=clean(row.status); const amount=number(row.amount); const estimated=number(row.estimatedValue); const quantity=number(row.quantity)
  if(!clean(row.contributorName)) errors.push('Contributor Name is required.')
  if(!clean(row.title)) errors.push('Contribution is required.')
  if(!IMPORTABLE_TYPES.includes(type)) errors.push('Direct vendor payments must be recorded through the governed Service Engagement/payment flow, not spreadsheet import.')
  if(!/^[A-Za-z]{3}$/.test(clean(row.currency))) errors.push('Currency must be a three-letter code such as USD.')
  if(!STATUS.includes(status)) errors.push('Status must be PLEDGED or RECEIVED.')
  if(CASH.has(type) && (amount==null || amount<=0)) errors.push('Cash contributions require a positive Amount.')
  if(amount!=null && amount<0) errors.push('Amount cannot be negative.')
  if(estimated!=null && estimated<0) errors.push('Estimated In-kind Value cannot be negative.')
  if(quantity!=null && quantity<0) errors.push('Quantity cannot be negative.')
  if(clean(row.expectedDate) && !date(row.expectedDate)) errors.push('Expected Date is invalid.')
  if(clean(row.contributorEmail) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(row.contributorEmail))) errors.push('Contributor Email is invalid.')
  return errors
}

export const contributionWorksheetSchema:ModuleSchema = {
  key:'contributions', name:'Contributions', description:'Wedding support ledger. Import creates safe cash/in-kind/pledge records; direct vendor payments stay in the payment workflow.', version:'1.0.0', fields, rowToRecord, recordToRow, validateRow,
  rowIdentity:(row)=>clean(row.contributionId)?`id:${clean(row.contributionId)}`:null,
  matchExisting:(row,existing)=>{ const id=clean(row.contributionId); if(!id)return {}; const record=existing.find((item)=>item.id===id); return record?{record,warning:'Imports only update title, notes and expected date on existing Contributions; financial facts remain protected.'}:{error:`Contribution ID "${id}" was not found in the active wedding.`} },
  fetchExisting:async(weddingId)=>db.$queryRaw<Array<any>>`
    SELECT c.id,c.contributor_id AS "contributorId",p.display_name AS "contributorName",p.email AS "contributorEmail",p.relationship,c.type,c.title,c.amount::float8 AS amount,c.currency,c.estimated_value::float8 AS "estimatedValue",c.quantity::float8 AS quantity,c.unit,c.commitment_state AS "commitmentState",c.fulfillment_state AS "fulfillmentState",c.expected_at AS "expectedAt",c.notes
      FROM wewed_contributions.wedding_contributions c JOIN wewed_contributions.contributors p ON p.id=c.contributor_id
     WHERE c.wedding_id=${weddingId} ORDER BY c.created_at
  `,
  upsert:async(weddingId,record,existing,context)=>{ const client=context?.db??db; const actorId=context?.actorId??null
    if(existing){
      await client.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET title=${record.title},notes=${record.notes},expected_at=${record.expectedAt},updated_at=NOW() WHERE id=${existing.id} AND wedding_id=${weddingId}`
      return { id:existing.id }
    }
    let contributorIdValue=record.contributorId as string|null
    if(contributorIdValue){ const rows=await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE id=${contributorIdValue} AND wedding_id=${weddingId} LIMIT 1`; if(!rows[0])throw new Error('Contributor ID was not found in the active wedding.') }
    else {
      const matches=record.contributorEmail ? await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE wedding_id=${weddingId} AND lower(email)=lower(${record.contributorEmail}) ORDER BY created_at LIMIT 2` : await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE wedding_id=${weddingId} AND lower(display_name)=lower(${record.contributorName}) ORDER BY created_at LIMIT 2`
      if(matches.length>1)throw new Error('Contributor match is ambiguous. Add the Contributor ID and import again.')
      contributorIdValue=matches[0]?.id??contributionId()
      if(!matches[0]) await client.$executeRaw`INSERT INTO wewed_contributions.contributors (id,wedding_id,display_name,relationship,email,kind) VALUES (${contributorIdValue},${weddingId},${record.contributorName},${record.relationship},${record.contributorEmail},'individual')`
    }
    const id=contributionId(); const inKind=IN_KIND.has(record.type); const pledged=record.status==='PLEDGED'; const fulfillment=pledged?'PENDING':inKind?'DELIVERED':'RECEIVED'; const commitment=pledged?'PLEDGED':'NOT_APPLICABLE'; const thank=pledged?'NOT_DUE':'TO_THANK'; const fulfilledAt=pledged?null:new Date()
    await client.$executeRaw`INSERT INTO wewed_contributions.wedding_contributions (id,wedding_id,contributor_id,type,title,amount,currency,estimated_value,estimated_value_currency,quantity,unit,route,commitment_state,fulfillment_state,verification_state,thank_you_state,expected_at,fulfilled_at,notes,source,recorded_by_id) VALUES (${id},${weddingId},${contributorIdValue},${record.type},${record.title},${record.amount},${record.currency},${record.estimatedValue},${record.estimatedValue==null?null:record.currency},${record.quantity},${record.unit},${inKind?'IN_KIND_TO_COUPLE':'TO_COUPLE'},${commitment},${fulfillment},'UNVERIFIED',${thank},${record.expectedAt},${fulfilledAt},${record.notes},'import',${actorId})`
    await client.auditEvent.create({ data:{ weddingId, action:'contribution.imported', resourceType:'WeddingContribution', resourceId:id, actorId, afterValue:JSON.stringify({ type:record.type, fulfillment, commitment }) } })
    return { id }
  },
  captureRollbackSnapshot:async(_weddingId,existing)=>({ title:existing.title,notes:existing.notes,expectedAt:existing.expectedAt }),
  deleteCreated:async(weddingId,id,context)=>{ const client=context?.db??db; const locks=await client.$queryRaw<Array<{count:bigint}>>`SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id=${weddingId} AND contribution_id=${id})+(SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id=${weddingId} AND contribution_id=${id}) AS count`; if(Number(locks[0]?.count??0)>0)throw new Error('Imported Contribution has since been allocated; rollback is blocked to preserve financial history.'); await client.$executeRaw`DELETE FROM wewed_contributions.wedding_contributions WHERE id=${id} AND wedding_id=${weddingId}` },
  restoreUpdated:async(weddingId,id,snapshot,context)=>{ const client=context?.db??db; await client.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET title=${snapshot.title},notes=${snapshot.notes},expected_at=${snapshot.expectedAt?new Date(snapshot.expectedAt):null},updated_at=NOW() WHERE id=${id} AND wedding_id=${weddingId}` },
}
