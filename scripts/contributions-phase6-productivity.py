from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))


# Contributions joins the existing spreadsheet engine. Direct vendor payments remain excluded from spreadsheet creation
# because reconstructing a payment/ServiceEngagement fact from a row would violate the accounting guardrails.
replace_once(
    'src/lib/import-engine/types.ts',
    "  | 'media'\n",
    "  | 'media'\n  | 'contributions'\n",
)

write(
    'src/lib/import-engine/contribution-worksheet-schema.ts',
    """import type { ModuleSchema } from './types'\nimport { db } from '@/lib/db'\nimport { contributionId } from '@/lib/contributions/store'\nimport { CONTRIBUTION_TYPES, type ContributionType } from '@/lib/contributions'\n\nconst IMPORTABLE_TYPES = CONTRIBUTION_TYPES.filter((type) => type !== 'DIRECT_VENDOR_PAYMENT')\nconst IN_KIND = new Set(['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'])\nconst CASH = new Set(['CASH_TO_COUPLE','HONEYMOON_GIFT'])\nconst STATUS = ['PLEDGED','RECEIVED']\n\nfunction clean(value:unknown):string { return value == null ? '' : String(value).replace(/\\u0000/g,'').replace(/\\r/g,'').trim() }\nfunction number(value:unknown):number|null { const source=clean(value).replace(/[$€£¥₹,\\s]/g,'').replace(/[A-Za-z]{3,6}$/g,''); if(!source)return null; const parsed=Number(source); return Number.isFinite(parsed)?parsed:null }\nfunction date(value:unknown):Date|null { const source=clean(value); if(!source)return null; const parsed=new Date(source); return Number.isNaN(parsed.getTime())?null:parsed }\nfunction iso(value:unknown):string { if(!value)return ''; const parsed=value instanceof Date?value:new Date(String(value)); return Number.isNaN(parsed.getTime())?'':parsed.toISOString().slice(0,10) }\n\nconst fields = [\n  { key:'contributionId', label:'Contribution ID', required:false, type:'string' as const, description:'Internal ID. Existing rows only update descriptive fields; financial facts are not rewritten by import.' },\n  { key:'contributorId', label:'Contributor ID', required:false, type:'string' as const, description:'Existing contributor ID, if known.' },\n  { key:'contributorName', label:'Contributor Name', required:true, type:'string' as const, example:'Tariro Moyo' },\n  { key:'contributorEmail', label:'Contributor Email', required:false, type:'email' as const, sensitive:true },\n  { key:'relationship', label:'Relationship', required:false, type:'string' as const, example:'Bride aunt' },\n  { key:'type', label:'Contribution Type', required:true, type:'enum' as const, allowedValues:IMPORTABLE_TYPES, example:'CASH_TO_COUPLE' },\n  { key:'title', label:'Contribution', required:true, type:'string' as const, example:'Help with catering' },\n  { key:'amount', label:'Amount', required:false, type:'currency' as const },\n  { key:'currency', label:'Currency', required:true, type:'string' as const, example:'USD' },\n  { key:'estimatedValue', label:'Estimated In-kind Value', required:false, type:'currency' as const },\n  { key:'quantity', label:'Quantity', required:false, type:'number' as const },\n  { key:'unit', label:'Unit', required:false, type:'string' as const, example:'hours' },\n  { key:'status', label:'Status', required:true, type:'enum' as const, allowedValues:STATUS, example:'PLEDGED' },\n  { key:'expectedDate', label:'Expected Date', required:false, type:'date' as const },\n  { key:'notes', label:'Notes', required:false, type:'string' as const },\n]\n\nfunction rowToRecord(row:Record<string,string>) {\n  return { contributionId:clean(row.contributionId)||null, contributorId:clean(row.contributorId)||null, contributorName:clean(row.contributorName), contributorEmail:clean(row.contributorEmail).toLowerCase()||null, relationship:clean(row.relationship)||null, type:clean(row.type) as ContributionType, title:clean(row.title), amount:number(row.amount), currency:clean(row.currency).toUpperCase(), estimatedValue:number(row.estimatedValue), quantity:number(row.quantity), unit:clean(row.unit)||null, status:clean(row.status), expectedAt:date(row.expectedDate), notes:clean(row.notes)||null }\n}\n\nfunction recordToRow(record:any):Record<string,string> {\n  return { contributionId:record.id??'', contributorId:record.contributorId??'', contributorName:record.contributorName??'', contributorEmail:record.contributorEmail??'', relationship:record.relationship??'', type:record.type??'', title:record.title??'', amount:record.amount==null?'':String(record.amount), currency:record.currency??'USD', estimatedValue:record.estimatedValue==null?'':String(record.estimatedValue), quantity:record.quantity==null?'':String(record.quantity), unit:record.unit??'', status:record.commitmentState==='PLEDGED'&&record.fulfillmentState==='PENDING'?'PLEDGED':'RECEIVED', expectedDate:iso(record.expectedAt), notes:record.notes??'' }\n}\n\nfunction validateRow(row:Record<string,string>):string[] {\n  const errors:string[]=[]; const type=clean(row.type) as ContributionType; const status=clean(row.status); const amount=number(row.amount); const estimated=number(row.estimatedValue); const quantity=number(row.quantity)\n  if(!clean(row.contributorName)) errors.push('Contributor Name is required.')\n  if(!clean(row.title)) errors.push('Contribution is required.')\n  if(!IMPORTABLE_TYPES.includes(type)) errors.push('Direct vendor payments must be recorded through the governed Service Engagement/payment flow, not spreadsheet import.')\n  if(!/^[A-Za-z]{3}$/.test(clean(row.currency))) errors.push('Currency must be a three-letter code such as USD.')\n  if(!STATUS.includes(status)) errors.push('Status must be PLEDGED or RECEIVED.')\n  if(CASH.has(type) && (amount==null || amount<=0)) errors.push('Cash contributions require a positive Amount.')\n  if(amount!=null && amount<0) errors.push('Amount cannot be negative.')\n  if(estimated!=null && estimated<0) errors.push('Estimated In-kind Value cannot be negative.')\n  if(quantity!=null && quantity<0) errors.push('Quantity cannot be negative.')\n  if(clean(row.expectedDate) && !date(row.expectedDate)) errors.push('Expected Date is invalid.')\n  if(clean(row.contributorEmail) && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(clean(row.contributorEmail))) errors.push('Contributor Email is invalid.')\n  return errors\n}\n\nexport const contributionWorksheetSchema:ModuleSchema = {\n  key:'contributions', name:'Contributions', description:'Wedding support ledger. Import creates safe cash/in-kind/pledge records; direct vendor payments stay in the payment workflow.', version:'1.0.0', fields, rowToRecord, recordToRow, validateRow,\n  rowIdentity:(row)=>clean(row.contributionId)?`id:${clean(row.contributionId)}`:null,\n  matchExisting:(row,existing)=>{ const id=clean(row.contributionId); if(!id)return {}; const record=existing.find((item)=>item.id===id); return record?{record,warning:'Imports only update title, notes and expected date on existing Contributions; financial facts remain protected.'}:{error:`Contribution ID "${id}" was not found in the active wedding.`} },\n  fetchExisting:async(weddingId)=>db.$queryRaw<Array<any>>`\n    SELECT c.id,c.contributor_id AS \"contributorId\",p.display_name AS \"contributorName\",p.email AS \"contributorEmail\",p.relationship,c.type,c.title,c.amount::float8 AS amount,c.currency,c.estimated_value::float8 AS \"estimatedValue\",c.quantity::float8 AS quantity,c.unit,c.commitment_state AS \"commitmentState\",c.fulfillment_state AS \"fulfillmentState\",c.expected_at AS \"expectedAt\",c.notes\n      FROM wewed_contributions.wedding_contributions c JOIN wewed_contributions.contributors p ON p.id=c.contributor_id\n     WHERE c.wedding_id=${weddingId} ORDER BY c.created_at\n  `,\n  upsert:async(weddingId,record,existing,context)=>{ const client=context?.db??db; const actorId=context?.actorId??null\n    if(existing){\n      await client.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET title=${record.title},notes=${record.notes},expected_at=${record.expectedAt},updated_at=NOW() WHERE id=${existing.id} AND wedding_id=${weddingId}`\n      return { id:existing.id }\n    }\n    let contributorIdValue=record.contributorId as string|null\n    if(contributorIdValue){ const rows=await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE id=${contributorIdValue} AND wedding_id=${weddingId} LIMIT 1`; if(!rows[0])throw new Error('Contributor ID was not found in the active wedding.') }\n    else {\n      const matches=record.contributorEmail ? await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE wedding_id=${weddingId} AND lower(email)=lower(${record.contributorEmail}) ORDER BY created_at LIMIT 2` : await client.$queryRaw<Array<{id:string}>>`SELECT id FROM wewed_contributions.contributors WHERE wedding_id=${weddingId} AND lower(display_name)=lower(${record.contributorName}) ORDER BY created_at LIMIT 2`\n      if(matches.length>1)throw new Error('Contributor match is ambiguous. Add the Contributor ID and import again.')\n      contributorIdValue=matches[0]?.id??contributionId()\n      if(!matches[0]) await client.$executeRaw`INSERT INTO wewed_contributions.contributors (id,wedding_id,display_name,relationship,email,kind) VALUES (${contributorIdValue},${weddingId},${record.contributorName},${record.relationship},${record.contributorEmail},'individual')`\n    }\n    const id=contributionId(); const inKind=IN_KIND.has(record.type); const pledged=record.status==='PLEDGED'; const fulfillment=pledged?'PENDING':inKind?'DELIVERED':'RECEIVED'; const commitment=pledged?'PLEDGED':'NOT_APPLICABLE'; const thank=pledged?'NOT_DUE':'TO_THANK'; const fulfilledAt=pledged?null:new Date()\n    await client.$executeRaw`INSERT INTO wewed_contributions.wedding_contributions (id,wedding_id,contributor_id,type,title,amount,currency,estimated_value,estimated_value_currency,quantity,unit,route,commitment_state,fulfillment_state,verification_state,thank_you_state,expected_at,fulfilled_at,notes,source,recorded_by_id) VALUES (${id},${weddingId},${contributorIdValue},${record.type},${record.title},${record.amount},${record.currency},${record.estimatedValue},${record.estimatedValue==null?null:record.currency},${record.quantity},${record.unit},${inKind?'IN_KIND_TO_COUPLE':'TO_COUPLE'},${commitment},${fulfillment},'UNVERIFIED',${thank},${record.expectedAt},${fulfilledAt},${record.notes},'import',${actorId})`\n    await client.auditEvent.create({ data:{ weddingId, action:'contribution.imported', resourceType:'WeddingContribution', resourceId:id, actorId, afterValue:JSON.stringify({ type:record.type, fulfillment, commitment }) } })\n    return { id }\n  },\n  captureRollbackSnapshot:async(_weddingId,existing)=>({ title:existing.title,notes:existing.notes,expectedAt:existing.expectedAt }),\n  deleteCreated:async(weddingId,id,context)=>{ const client=context?.db??db; const locks=await client.$queryRaw<Array<{count:bigint}>>`SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id=${weddingId} AND contribution_id=${id})+(SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id=${weddingId} AND contribution_id=${id}) AS count`; if(Number(locks[0]?.count??0)>0)throw new Error('Imported Contribution has since been allocated; rollback is blocked to preserve financial history.'); await client.$executeRaw`DELETE FROM wewed_contributions.wedding_contributions WHERE id=${id} AND wedding_id=${weddingId}` },\n  restoreUpdated:async(weddingId,id,snapshot,context)=>{ const client=context?.db??db; await client.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET title=${snapshot.title},notes=${snapshot.notes},expected_at=${snapshot.expectedAt?new Date(snapshot.expectedAt):null},updated_at=NOW() WHERE id=${id} AND wedding_id=${weddingId}` },\n}\n""",
)

# Register the worksheet with the established import/template/export engine.
replace_once('src/lib/import-engine/schemas.ts', "import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'\n", "import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'\nimport { contributionWorksheetSchema } from './contribution-worksheet-schema'\n")
replace_once('src/lib/import-engine/schemas.ts', "export const MODULE_SCHEMAS: Record<string, ModuleSchema> = {\n  guests:", "export const MODULE_SCHEMAS: Record<string, ModuleSchema> = {\n  contributions: contributionWorksheetSchema,\n  guests:")
replace_once('src/components/wedding/import-export-bar.tsx', "  media: 'Media',\n}", "  media: 'Media',\n  contributions: 'Contributions',\n}")
replace_once('src/app/api/imports/route.ts', "Valid modules: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media.", "Valid modules: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media, contributions.")

# Contributions becomes a normal worksheet with template/import/export/history controls.
stage7='src/components/wedding/planner-workspace-stage7.tsx'
replace_once(stage7, "worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating'", "worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating' | 'contributions'")
replace_once(stage7, "{ value: 'contributions', label: 'Contributions' },", "{ value: 'contributions', label: 'Contributions', worksheetKey: 'contributions' },")

# AI productivity route is draft-only. It cannot mutate financial facts, send a message, or create a task.
write(
    'src/app/api/planner/contributions/[id]/assist/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { generateAiText } from '@/lib/ai'\nimport { db } from '@/lib/db'\nimport { getContribution } from '@/lib/contributions/store'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\ninterface RouteContext { params:Promise<{id:string}> }\n\nexport async function POST(request:NextRequest, context:RouteContext) {\n  const access=await requireWeddingPermission(request,'budget.view'); if(access.error)return access.error\n  const {id}=await context.params; const weddingId=access.context.weddingId; const body=(await request.json()) as Record<string,unknown>; const action=String(body.action??'')\n  if(!['draft-thank-you','draft-follow-up-task'].includes(action)) return NextResponse.json({success:false,error:'Choose a supported drafting action.'},{status:400})\n  const contribution=await getContribution(weddingId,id); if(!contribution)return NextResponse.json({success:false,error:'Contribution not found.'},{status:404})\n  const people=await db.$queryRaw<Array<{displayName:string;relationship:string|null}>>`SELECT p.display_name AS \"displayName\",p.relationship FROM wewed_contributions.wedding_contributions c JOIN wewed_contributions.contributors p ON p.id=c.contributor_id WHERE c.id=${id} AND c.wedding_id=${weddingId} LIMIT 1`\n  const person=people[0]; const purpose=action==='draft-thank-you'?'a concise, warm thank-you note':'a concise Planner follow-up task title'\n  const result=await generateAiText({ profile:'private', maxOutputTokens:220, messages:[{role:'system',content:'You assist a wedding planner. Draft text only. Never claim money was received, paid, verified, sent, or reconciled unless the supplied record explicitly says so. Never mutate data. Do not invent dates, amounts, vendors, promises, or evidence.'},{role:'user',content:`Draft ${purpose}. Contributor: ${person?.displayName??'Contributor'}. Relationship: ${person?.relationship??'not recorded'}. Contribution title: ${contribution.title}. Type: ${contribution.type}. Fulfillment: ${contribution.fulfillmentState}. Verification: ${contribution.verificationState}. Thank-you state: ${contribution.thankYouState}. Keep the wording appreciative and non-transactional.`}] })\n  return NextResponse.json({success:true,data:{action,draft:result.text,provider:result.provider,model:result.model,requiresUserConfirmation:true,financialMutationPerformed:false}})\n}\n""",
)

# UI: AI text can only be adopted by a separate explicit user action. Task creation and Notebook save remain existing confirmed buttons.
ui='src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(ui, "  const [giftingShare, setGiftingShare] = useState<{url:string;qr:string}|null>(null)\n", "  const [giftingShare, setGiftingShare] = useState<{url:string;qr:string}|null>(null)\n  const [aiDraft, setAiDraft] = useState<{kind:'thank'|'task';text:string}|null>(null)\n")
replace_once(
    ui,
    "  async function createNotebookNote() {",
    """  async function draftWithAi(action:'draft-thank-you'|'draft-follow-up-task') {
    if(!manage)return
    setSaving(true)
    try {
      const response=await fetch(`/api/planner/contributions/${manage.id}/assist`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})})
      const body=await response.json(); if(!response.ok||body.success===false)throw new Error(body.error||'AI draft unavailable.')
      setAiDraft({kind:action==='draft-thank-you'?'thank':'task',text:body.data.draft})
    } catch(reason){toast({title:'AI draft unavailable',description:reason instanceof Error?reason.message:undefined,variant:'destructive'})}
    finally{setSaving(false)}
  }

  async function createNotebookNote() {""",
)
# Insert AI drafting block before existing follow-up/task+Notebook grid.
replace_once(
    ui,
    "<div className=\"mt-4 grid gap-3 sm:grid-cols-2\"><div className=\"rounded-xl border border-gold/15 p-3\"><h3 className=\"font-medium\">Follow-up task</h3>",
    """<div className="mt-4 rounded-xl border border-gold/15 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">AI drafting assistant</h3><p className="text-xs text-champagne/45">Drafts text only. Nothing is sent, marked paid, verified, or created until you choose an existing Wewed action.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={()=>void draftWithAi('draft-follow-up-task')} className="border-gold/20 bg-transparent">Draft task</Button><Button size="sm" variant="outline" disabled={saving} onClick={()=>void draftWithAi('draft-thank-you')} className="border-gold/20 bg-transparent">Draft thank-you</Button></div></div>{aiDraft && <div className="mt-3 rounded-lg border border-gold/10 bg-espresso/50 p-3"><p className="whitespace-pre-wrap text-xs leading-5 text-champagne/70">{aiDraft.text}</p><div className="mt-2 flex flex-wrap gap-2">{aiDraft.kind==='task' ? <Button size="sm" onClick={()=>{setTaskTitle(aiDraft.text);setAiDraft(null)}} className="bg-gold text-espresso">Use as task title</Button> : <Button size="sm" onClick={()=>{setNoteText(aiDraft.text);setAiDraft(null)}} className="bg-gold text-espresso">Use as thank-you draft in Notebook</Button>}<Button size="sm" variant="ghost" onClick={()=>setAiDraft(null)}>Discard</Button></div></div>}</div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Follow-up task</h3>""",
)

# Export remains available as direct CSV for compatibility, while the worksheet engine now provides governed XLSX/template/import/history.
contract='src/lib/contributions-source-contract.test.ts'
insert="""
  test('Phase 6 uses the existing worksheet engine and keeps AI drafting confirmation-only', () => {
    const types=read('src/lib/import-engine/types.ts')
    const schemas=read('src/lib/import-engine/schemas.ts')
    const contributionSchema=read('src/lib/import-engine/contribution-worksheet-schema.ts')
    const stage7=read('src/components/wedding/planner-workspace-stage7.tsx')
    const assist=read('src/app/api/planner/contributions/[id]/assist/route.ts')
    const ui=read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(types).toContain("| 'contributions'")
    expect(schemas).toContain('contributions: contributionWorksheetSchema')
    expect(contributionSchema).toContain('Direct vendor payments must be recorded through the governed Service Engagement/payment flow')
    expect(stage7).toContain("worksheetKey: 'contributions'")
    expect(assist).toContain('requiresUserConfirmation:true')
    expect(assist).toContain('financialMutationPerformed:false')
    expect(assist).not.toContain('plannerTask.create')
    expect(ui).toContain('Use as task title')
    expect(ui).toContain('Use as thank-you draft in Notebook')
  })
"""
text=read(contract);needle="\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle)!=1:raise SystemExit('Phase 6 contract insertion point not unique')
write(contract,text.replace(needle,insert+needle,1))

print('Contributions Phase 6 recognition/import-export/AI productivity remediation applied.')
