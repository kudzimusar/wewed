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
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:160]!r}')
    write(path, text.replace(old, new, 1))


# Contributor detail/edit endpoint. Identity remains wedding-scoped and audit logged.
write(
    'src/app/api/planner/contributors/[id]/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\ninterface RouteContext { params: Promise<{ id: string }> }\n\nconst KINDS = new Set(['individual','family','organisation'])\nconst CONTACT_METHODS = new Set(['email','phone','other'])\n\nexport async function GET(request: NextRequest, context: RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const rows = await db.$queryRaw<Array<{ id:string; displayName:string; legalName:string|null; kind:string; relationship:string|null; email:string|null; phone:string|null; address:string|null; preferredContactMethod:string|null; publicRecognition:boolean; anonymousPublic:boolean; notes:string|null; guestId:string|null }>>`\n    SELECT id, display_name AS \"displayName\", legal_name AS \"legalName\", kind, relationship, email, phone, address,\n           preferred_contact_method AS \"preferredContactMethod\", public_recognition AS \"publicRecognition\",\n           anonymous_public AS \"anonymousPublic\", notes, guest_id AS \"guestId\"\n      FROM wewed_contributions.contributors\n     WHERE id = ${id} AND wedding_id = ${weddingId}\n     LIMIT 1\n  `\n  if (!rows[0]) return NextResponse.json({ success:false, error:'Contributor not found.' }, { status:404 })\n  const history = await db.$queryRaw<Array<{ id:string; title:string; type:string; amount:string|null; currency:string; estimatedValue:string|null; estimatedValueCurrency:string|null; fulfillmentState:string; thankYouState:string; createdAt:Date }>>`\n    SELECT id, title, type, amount::text AS amount, currency, estimated_value::text AS \"estimatedValue\",\n           estimated_value_currency AS \"estimatedValueCurrency\", fulfillment_state AS \"fulfillmentState\",\n           thank_you_state AS \"thankYouState\", created_at AS \"createdAt\"\n      FROM wewed_contributions.wedding_contributions\n     WHERE wedding_id = ${weddingId} AND contributor_id = ${id}\n     ORDER BY created_at DESC\n  `\n  return NextResponse.json({ success:true, data:{ ...rows[0], history: history.map((item) => ({ ...item, amount:item.amount===null?null:Number(item.amount), estimatedValue:item.estimatedValue===null?null:Number(item.estimatedValue), createdAt:item.createdAt.toISOString() })) } })\n}\n\nexport async function PATCH(request: NextRequest, context: RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.edit')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const actorId = access.context.session.userId\n  const body = (await request.json()) as Record<string, unknown>\n  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null\n  if (body.displayName !== undefined && !displayName) return NextResponse.json({ success:false, error:'Contributor name is required.' }, { status:400 })\n  const kind = body.kind === undefined ? null : String(body.kind).trim().toLowerCase()\n  if (kind && !KINDS.has(kind)) return NextResponse.json({ success:false, error:'Choose a valid contributor type.' }, { status:400 })\n  const preferred = body.preferredContactMethod === undefined ? undefined : String(body.preferredContactMethod ?? '').trim().toLowerCase() || null\n  if (preferred && !CONTACT_METHODS.has(preferred)) return NextResponse.json({ success:false, error:'Choose a valid contact preference.' }, { status:400 })\n  const email = body.email === undefined ? undefined : String(body.email ?? '').trim().toLowerCase() || null\n  if (email && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return NextResponse.json({ success:false, error:'Enter a valid contributor email.' }, { status:400 })\n  const existing = await db.$queryRaw<Array<{ id:string }>>`SELECT id FROM wewed_contributions.contributors WHERE id=${id} AND wedding_id=${weddingId} LIMIT 1`\n  if (!existing[0]) return NextResponse.json({ success:false, error:'Contributor not found.' }, { status:404 })\n  await db.$transaction(async (tx) => {\n    await tx.$executeRaw`\n      UPDATE wewed_contributions.contributors\n         SET display_name = COALESCE(${displayName}, display_name),\n             legal_name = CASE WHEN ${body.legalName !== undefined} THEN ${String(body.legalName ?? '').trim() || null} ELSE legal_name END,\n             kind = COALESCE(${kind}, kind),\n             relationship = CASE WHEN ${body.relationship !== undefined} THEN ${String(body.relationship ?? '').trim() || null} ELSE relationship END,\n             email = CASE WHEN ${body.email !== undefined} THEN ${email} ELSE email END,\n             phone = CASE WHEN ${body.phone !== undefined} THEN ${String(body.phone ?? '').trim() || null} ELSE phone END,\n             address = CASE WHEN ${body.address !== undefined} THEN ${String(body.address ?? '').trim() || null} ELSE address END,\n             preferred_contact_method = CASE WHEN ${body.preferredContactMethod !== undefined} THEN ${preferred} ELSE preferred_contact_method END,\n             public_recognition = CASE WHEN ${body.publicRecognition !== undefined} THEN ${body.publicRecognition === true} ELSE public_recognition END,\n             anonymous_public = CASE WHEN ${body.anonymousPublic !== undefined} THEN ${body.anonymousPublic === true} ELSE anonymous_public END,\n             notes = CASE WHEN ${body.notes !== undefined} THEN ${String(body.notes ?? '').trim() || null} ELSE notes END,\n             updated_at = NOW()\n       WHERE id = ${id} AND wedding_id = ${weddingId}\n    `\n    await tx.auditEvent.create({ data:{ weddingId, eventType:'contributor.updated', actorType:'user', actorId, targetType:'Contributor', targetId:id, payload:JSON.stringify({ fields:Object.keys(body) }), severity:'info' } })\n  })\n  return NextResponse.json({ success:true })\n}\n""",
)

# Governed Vault evidence endpoint: upload through existing private Vault, link only; unlink preserves the retained Vault object.
write(
    'src/app/api/planner/contributions/[id]/evidence/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { logAuditEvent } from '@/lib/audit'\nimport { getContribution } from '@/lib/contributions/store'\nimport { createVaultLink, prepareVaultUpload, registerPreparedVaultObject, removePreparedVaultUpload } from '@/lib/vault/core'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\ninterface RouteContext { params: Promise<{ id:string }> }\n\nasync function ensureContribution(weddingId:string, id:string) {\n  const contribution = await getContribution(weddingId, id)\n  if (!contribution) throw new Error('CONTRIBUTION_NOT_FOUND')\n  return contribution\n}\n\nexport async function GET(request:NextRequest, context:RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  try {\n    await ensureContribution(weddingId, id)\n    const links = await db.vaultLink.findMany({ where:{ weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence' }, include:{ vaultObject:true }, orderBy:{ createdAt:'desc' } })\n    return NextResponse.json({ success:true, data:links.filter((link) => !link.vaultObject.deletedAt).map((link) => ({ id:link.id, vaultObjectId:link.vaultObjectId, displayName:link.vaultObject.displayName, mimeType:link.vaultObject.mimeType, byteSize:Number(link.vaultObject.byteSize), storageState:link.vaultObject.storageState, scanState:link.vaultObject.scanState, createdAt:link.createdAt.toISOString() })) })\n  } catch (error) {\n    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })\n    console.error('[CONTRIBUTION EVIDENCE GET] error', error)\n    return NextResponse.json({ success:false, error:'Could not load contribution evidence.' }, { status:500 })\n  }\n}\n\nexport async function POST(request:NextRequest, context:RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.edit')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const actorId = access.context.session.userId\n  try {\n    await ensureContribution(weddingId, id)\n    const form = await request.formData()\n    const file = form.get('file')\n    if (!(file instanceof File)) return NextResponse.json({ success:false, error:'Choose evidence to attach.' }, { status:400 })\n    const prepared = await prepareVaultUpload({ file, weddingId, actorId, source:'contribution_evidence', category:'wedding_document', metadata:{ contributionId:id } })\n    try {\n      await db.$transaction(async (tx) => {\n        await registerPreparedVaultObject(prepared, tx)\n        await createVaultLink({ vaultObjectId:prepared.id, weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence', actorId, tx })\n        await tx.auditEvent.create({ data:{ weddingId, eventType:'contribution.evidence_attached', actorType:'user', actorId, targetType:'WeddingContribution', targetId:id, payload:JSON.stringify({ vaultObjectId:prepared.id, filename:prepared.displayName }), severity:'info' } })\n      })\n    } catch (error) {\n      await removePreparedVaultUpload(prepared)\n      throw error\n    }\n    await logAuditEvent({ action:'vault.object.linked_to_contribution', resourceType:'VaultObject', resourceId:prepared.id, weddingId, actorId, afterValue:{ contributionId:id, linkRole:'evidence' } })\n    return NextResponse.json({ success:true, data:{ vaultObjectId:prepared.id, displayName:prepared.displayName, available:prepared.distributable } }, { status:201 })\n  } catch (error) {\n    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })\n    console.error('[CONTRIBUTION EVIDENCE POST] error', error)\n    const message = error instanceof Error ? error.message : 'Could not attach contribution evidence.'\n    return NextResponse.json({ success:false, error:message }, { status:500 })\n  }\n}\n\nexport async function DELETE(request:NextRequest, context:RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.edit')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const actorId = access.context.session.userId\n  try {\n    await ensureContribution(weddingId, id)\n    const body = (await request.json()) as { linkId?:string }\n    const linkId = String(body.linkId ?? '').trim()\n    if (!linkId) return NextResponse.json({ success:false, error:'Evidence link is required.' }, { status:400 })\n    const link = await db.vaultLink.findFirst({ where:{ id:linkId, weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence' }, select:{ id:true, vaultObjectId:true } })\n    if (!link) return NextResponse.json({ success:false, error:'Evidence link not found.' }, { status:404 })\n    await db.$transaction(async (tx) => {\n      await tx.vaultLink.delete({ where:{ id:link.id } })\n      await tx.auditEvent.create({ data:{ weddingId, eventType:'contribution.evidence_unlinked', actorType:'user', actorId, targetType:'WeddingContribution', targetId:id, payload:JSON.stringify({ vaultObjectId:link.vaultObjectId }), severity:'warning' } })\n    })\n    return NextResponse.json({ success:true })\n  } catch (error) {\n    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })\n    console.error('[CONTRIBUTION EVIDENCE DELETE] error', error)\n    return NextResponse.json({ success:false, error:'Could not unlink contribution evidence.' }, { status:500 })\n  }\n}\n""",
)

# Expand safe contribution edits beyond title/notes while retaining financial locks.
detail = 'src/app/api/planner/contributions/[id]/route.ts'
replace_once(
    detail,
    "    const fulfilledAt = body.fulfilledAt === undefined ? null : body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null\n",
    """    const fulfilledAt = body.fulfilledAt === undefined ? null : body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null
    const expectedAt = body.expectedAt === undefined ? undefined : body.expectedAt ? new Date(String(body.expectedAt)) : null
    if (expectedAt instanceof Date && Number.isNaN(expectedAt.getTime())) return NextResponse.json({ success:false, error:'Use a valid expected date.' }, { status:400 })
    const estimatedValue = body.estimatedValue === undefined ? undefined : finiteNonNegative(body.estimatedValue)
    if (body.estimatedValue !== undefined && body.estimatedValue !== null && body.estimatedValue !== '' && estimatedValue === null) return NextResponse.json({ success:false, error:'Estimated value must be zero or more.' }, { status:400 })
    const quantity = body.quantity === undefined ? undefined : finiteNonNegative(body.quantity)
    if (body.quantity !== undefined && body.quantity !== null && body.quantity !== '' && quantity === null) return NextResponse.json({ success:false, error:'Quantity must be zero or more.' }, { status:400 })
""",
)
replace_once(
    detail,
    "             fulfilled_at = CASE WHEN ${body.fulfilledAt !== undefined} THEN ${fulfilledAt} ELSE fulfilled_at END,\n             updated_at = NOW()",
    """             fulfilled_at = CASE WHEN ${body.fulfilledAt !== undefined} THEN ${fulfilledAt} ELSE fulfilled_at END,
             expected_at = CASE WHEN ${body.expectedAt !== undefined} THEN ${expectedAt} ELSE expected_at END,
             estimated_value = CASE WHEN ${body.estimatedValue !== undefined} THEN ${estimatedValue} ELSE estimated_value END,
             estimated_value_currency = CASE WHEN ${body.estimatedValueCurrency !== undefined} THEN ${body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : NULL} ELSE estimated_value_currency END,
             quantity = CASE WHEN ${body.quantity !== undefined} THEN ${quantity} ELSE quantity END,
             unit = CASE WHEN ${body.unit !== undefined} THEN ${String(body.unit ?? '').trim() || null} ELSE unit END,
             updated_at = NOW()""",
)

# Contributions UI: contributor profile/history, safe contribution edit form, and governed evidence.
ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "interface Contributor { id: string; displayName: string; kind: string; email: string | null; phone: string | null; address: string | null; preferredContactMethod: string | null; relationship: string | null; publicRecognition: boolean }",
    "interface Contributor { id: string; displayName: string; legalName?: string | null; kind: string; email: string | null; phone: string | null; address: string | null; preferredContactMethod: string | null; relationship: string | null; publicRecognition: boolean; anonymousPublic?: boolean; notes?: string | null; history?: Array<{id:string;title:string;type:string;amount:number|null;currency:string;estimatedValue:number|null;estimatedValueCurrency:string|null;fulfillmentState:string;thankYouState:string;createdAt:string}> }",
)
replace_once(
    ui,
    "interface FundingItem { id: string; description: string; paidAmount: number; currency: string; category: string; unattributed: number; funding: Array<{ sourceKind: string; contributionId: string | null; amount: number; currency: string }> }",
    "interface FundingItem { id: string; description: string; paidAmount: number; currency: string; category: string; unattributed: number; funding: Array<{ sourceKind: string; contributionId: string | null; amount: number; currency: string }> }\ninterface EvidenceItem { id:string; vaultObjectId:string; displayName:string; mimeType:string; byteSize:number; storageState:string; scanState:string; createdAt:string }",
)
replace_once(
    ui,
    "  const [directPaymentReference, setDirectPaymentReference] = useState('')\n",
    """  const [directPaymentReference, setDirectPaymentReference] = useState('')
  const [contributorProfile, setContributorProfile] = useState<Contributor | null>(null)
  const [contributorEdit, setContributorEdit] = useState({ displayName:'', legalName:'', kind:'individual', relationship:'', email:'', phone:'', address:'', preferredContactMethod:'', publicRecognition:false, anonymousPublic:false, notes:'' })
  const [contributionEdit, setContributionEdit] = useState({ title:'', description:'', notes:'', expectedAt:'', estimatedValue:'', quantity:'', unit:'' })
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
""",
)
# Functions are inserted before createNotebookNote for stable placement.
replace_once(
    ui,
    "  async function createNotebookNote() {",
    """  async function loadContributionDetails(item: Contribution) {
    setManage(item)
    setDirectPaymentReference('')
    setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)
    setContributionEdit({ title:item.title, description:item.description ?? '', notes:item.notes ?? '', expectedAt:'', estimatedValue:item.estimatedValue === null ? '' : String(item.estimatedValue), quantity:item.quantity === null ? '' : String(item.quantity), unit:item.unit ?? '' })
    setEvidence([])
    setContributorProfile(null)
    try {
      const [personResponse,evidenceResponse] = await Promise.all([
        fetch(`/api/planner/contributors/${item.contributor.id}`, { cache:'no-store' }),
        fetch(`/api/planner/contributions/${item.id}/evidence`, { cache:'no-store' }),
      ])
      if (personResponse.ok) {
        const personBody = await personResponse.json()
        if (personBody.success !== false && personBody.data) {
          setContributorProfile(personBody.data)
          setContributorEdit({ displayName:personBody.data.displayName ?? '', legalName:personBody.data.legalName ?? '', kind:personBody.data.kind ?? 'individual', relationship:personBody.data.relationship ?? '', email:personBody.data.email ?? '', phone:personBody.data.phone ?? '', address:personBody.data.address ?? '', preferredContactMethod:personBody.data.preferredContactMethod ?? '', publicRecognition:personBody.data.publicRecognition === true, anonymousPublic:personBody.data.anonymousPublic === true, notes:personBody.data.notes ?? '' })
        }
      }
      if (evidenceResponse.ok) {
        const evidenceBody = await evidenceResponse.json()
        if (evidenceBody.success !== false) setEvidence(evidenceBody.data ?? [])
      }
    } catch { /* Detail enrichment must not hide the core contribution record. */ }
  }

  async function saveContributorProfile() {
    if (!manage || !canEdit) return
    const success = await mutate(`/api/planner/contributors/${manage.contributor.id}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify(contributorEdit) })
    if (success) {
      const response = await fetch(`/api/planner/contributors/${manage.contributor.id}`, { cache:'no-store' })
      if (response.ok) { const body = await response.json(); if (body.data) setContributorProfile(body.data) }
      toast({ title:'Contributor updated' })
    }
  }

  async function saveContributionDetails() {
    if (!manage || !canEdit) return
    const success = await mutate(`/api/planner/contributions/${manage.id}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ title:contributionEdit.title, description:contributionEdit.description, notes:contributionEdit.notes, expectedAt:contributionEdit.expectedAt || null, estimatedValue:contributionEdit.estimatedValue === '' ? null : Number(contributionEdit.estimatedValue), quantity:contributionEdit.quantity === '' ? null : Number(contributionEdit.quantity), unit:contributionEdit.unit || null }) })
    if (success) { setManage(null); toast({ title:'Contribution updated' }) }
  }

  async function attachEvidence() {
    if (!manage || !canEdit || !evidenceFile) return
    setSaving(true)
    try {
      const formData = new FormData(); formData.set('file', evidenceFile)
      const response = await fetch(`/api/planner/contributions/${manage.id}/evidence`, { method:'POST', body:formData })
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not attach evidence.')
      setEvidenceFile(null)
      const refresh = await fetch(`/api/planner/contributions/${manage.id}/evidence`, { cache:'no-store' })
      const refreshed = await refresh.json(); if (refresh.ok && refreshed.success !== false) setEvidence(refreshed.data ?? [])
      toast({ title:'Evidence attached', description:'Stored in the governed Wewed Vault.' })
    } catch (reason) { toast({ title:'Evidence upload failed', description:reason instanceof Error ? reason.message : undefined, variant:'destructive' }) }
    finally { setSaving(false) }
  }

  async function openEvidence(item: EvidenceItem) {
    const response = await fetch(`/api/vault/${item.vaultObjectId}`, { cache:'no-store' })
    const body = await response.json()
    if (!response.ok || body.success === false || !body.data?.signedUrl) { toast({ title:'Evidence unavailable', description:body.error, variant:'destructive' }); return }
    window.open(body.data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function unlinkEvidence(item: EvidenceItem) {
    if (!manage || !canEdit) return
    const success = await mutate(`/api/planner/contributions/${manage.id}/evidence`, { method:'DELETE', headers:{'content-type':'application/json'}, body:JSON.stringify({ linkId:item.id }) })
    if (success) setEvidence((current) => current.filter((candidate) => candidate.id !== item.id))
  }

  async function createNotebookNote() {""",
)
# Replace both manage-open handlers with central loader. Previous hardening changed these exact forms.
text = read(ui)
old = "setManage(item); setDirectPaymentReference(''); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)"
if text.count(old) != 2:
    raise SystemExit(f'{ui}: expected two managed-entry handlers after final hardening, found {text.count(old)}')
write(ui, text.replace(old, "void loadContributionDetails(item)", 2))
# Add detail/edit/evidence/contributor profile inside manage dialog before follow-up grid.
replace_once(
    ui,
    "<div className=\"mt-4 grid gap-3 sm:grid-cols-2\"><div className=\"rounded-xl border border-gold/15 p-3\"><h3 className=\"font-medium\">Follow-up task</h3>",
    """<div className="mt-4 rounded-xl border border-gold/15 p-3"><div className="flex items-center justify-between gap-2"><div><h3 className="font-medium">Contribution details</h3><p className="text-xs text-champagne/45">Ordinary corrections stay editable; reconciled financial facts remain protected.</p></div>{canEdit && <Button size="sm" variant="outline" onClick={() => void saveContributionDetails()} className="border-gold/20 bg-transparent">Save details</Button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Input disabled={!canEdit} value={contributionEdit.title} onChange={(e)=>setContributionEdit((c)=>({...c,title:e.target.value}))} placeholder="Contribution title" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} type="date" value={contributionEdit.expectedAt} onChange={(e)=>setContributionEdit((c)=>({...c,expectedAt:e.target.value}))} className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} inputMode="decimal" value={contributionEdit.estimatedValue} onChange={(e)=>setContributionEdit((c)=>({...c,estimatedValue:e.target.value}))} placeholder="Estimated value" className="border-gold/20 bg-espresso/70"/><div className="grid grid-cols-2 gap-2"><Input disabled={!canEdit} inputMode="decimal" value={contributionEdit.quantity} onChange={(e)=>setContributionEdit((c)=>({...c,quantity:e.target.value}))} placeholder="Quantity" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} value={contributionEdit.unit} onChange={(e)=>setContributionEdit((c)=>({...c,unit:e.target.value}))} placeholder="Unit" className="border-gold/20 bg-espresso/70"/></div><Textarea disabled={!canEdit} value={contributionEdit.description} onChange={(e)=>setContributionEdit((c)=>({...c,description:e.target.value}))} placeholder="Description" className="border-gold/20 bg-espresso/70 sm:col-span-2"/><Textarea disabled={!canEdit} value={contributionEdit.notes} onChange={(e)=>setContributionEdit((c)=>({...c,notes:e.target.value}))} placeholder="Private notes" className="border-gold/20 bg-espresso/70 sm:col-span-2"/></div></div>

      <div className="mt-4 rounded-xl border border-gold/15 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">Contributor profile</h3><p className="text-xs text-champagne/45">Reusable identity and private contact record for this wedding.</p></div>{canEdit && <Button size="sm" variant="outline" onClick={() => void saveContributorProfile()} className="border-gold/20 bg-transparent">Save person</Button>}</div>{contributorProfile ? <><div className="mt-3 grid gap-2 sm:grid-cols-2"><Input disabled={!canEdit} value={contributorEdit.displayName} onChange={(e)=>setContributorEdit((c)=>({...c,displayName:e.target.value}))} placeholder="Display name" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} value={contributorEdit.legalName} onChange={(e)=>setContributorEdit((c)=>({...c,legalName:e.target.value}))} placeholder="Legal / organisation name" className="border-gold/20 bg-espresso/70"/><select disabled={!canEdit} value={contributorEdit.kind} onChange={(e)=>setContributorEdit((c)=>({...c,kind:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="individual">Individual</option><option value="family">Family / household</option><option value="organisation">Organisation / sponsor</option></select><Input disabled={!canEdit} value={contributorEdit.relationship} onChange={(e)=>setContributorEdit((c)=>({...c,relationship:e.target.value}))} placeholder="Relationship" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} type="email" value={contributorEdit.email} onChange={(e)=>setContributorEdit((c)=>({...c,email:e.target.value}))} placeholder="Email" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} value={contributorEdit.phone} onChange={(e)=>setContributorEdit((c)=>({...c,phone:e.target.value}))} placeholder="Phone" className="border-gold/20 bg-espresso/70"/><Input disabled={!canEdit} value={contributorEdit.address} onChange={(e)=>setContributorEdit((c)=>({...c,address:e.target.value}))} placeholder="Address" className="border-gold/20 bg-espresso/70 sm:col-span-2"/><Textarea disabled={!canEdit} value={contributorEdit.notes} onChange={(e)=>setContributorEdit((c)=>({...c,notes:e.target.value}))} placeholder="Private contributor notes" className="border-gold/20 bg-espresso/70 sm:col-span-2"/></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-champagne/60"><label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={contributorEdit.publicRecognition} onCheckedChange={(checked)=>setContributorEdit((c)=>({...c,publicRecognition:checked===true}))}/>Public acknowledgement allowed</label><label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={contributorEdit.anonymousPublic} onCheckedChange={(checked)=>setContributorEdit((c)=>({...c,anonymousPublic:checked===true}))}/>Keep public identity anonymous</label></div>{contributorProfile.history?.length ? <div className="mt-4"><p className="text-[10px] uppercase tracking-[0.14em] text-gold">Contribution history</p><div className="mt-2 space-y-1">{contributorProfile.history.slice(0,6).map((entry)=><div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 px-2.5 py-2 text-xs"><span className="truncate">{entry.title}</span><span className="shrink-0 text-champagne/45">{entry.amount !== null ? money(entry.amount,entry.currency) : entry.estimatedValue !== null ? `${money(entry.estimatedValue,entry.estimatedValueCurrency || entry.currency)} est.` : human(entry.fulfillmentState)}</span></div>)}</div></div> : <p className="mt-3 text-xs text-champagne/45">This is the contributor's first recorded item.</p>}</> : <p className="mt-3 text-xs text-champagne/45">Loading contributor profile…</p>}</div>

      <div className="mt-4 rounded-xl border border-gold/15 p-3"><div><h3 className="font-medium">Evidence in Wewed Vault</h3><p className="mt-1 text-xs text-champagne/50">Attach proof, receipts, letters or delivery confirmation. Files remain private and governed by Vault retention rules.</p></div>{canEdit && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="file" onChange={(e)=>setEvidenceFile(e.target.files?.[0] ?? null)} className="border-gold/20 bg-espresso/70"/><Button disabled={saving || !evidenceFile} onClick={() => void attachEvidence()} className="bg-gold text-espresso">Attach evidence</Button></div>}<div className="mt-3 space-y-2">{evidence.length ? evidence.map((item)=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-gold/10 p-2"><button type="button" onClick={() => void openEvidence(item)} className="min-w-0 truncate text-left text-xs text-gold hover:underline">{item.displayName}</button><div className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-champagne/40">{item.scanState === 'content_validated' ? 'Ready' : 'Scanning'}</span>{canEdit && <Button size="sm" variant="ghost" onClick={() => void unlinkEvidence(item)} className="h-7 px-2 text-[10px] text-champagne/45">Unlink</Button>}</div></div>) : <p className="text-xs text-champagne/40">No evidence attached.</p>}</div></div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Follow-up task</h3>""",
)

# Static contracts ensure Phase 2 cannot regress back to schema-only details or parallel evidence storage.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """
  test('Phase 2 exposes contributor/contribution edit and governed Vault evidence', () => {
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    const contributor = read('src/app/api/planner/contributors/[id]/route.ts')
    const evidence = read('src/app/api/planner/contributions/[id]/evidence/route.ts')
    expect(ui).toContain('Contributor profile')
    expect(ui).toContain('Contribution history')
    expect(ui).toContain('Evidence in Wewed Vault')
    expect(ui).toContain('Save details')
    expect(contributor).toContain("eventType:'contributor.updated'")
    expect(evidence).toContain('prepareVaultUpload')
    expect(evidence).toContain("entityType:'WeddingContribution'")
    expect(evidence).toContain("linkRole:'evidence'")
    expect(evidence).not.toContain('createBucket')
  })
"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('Phase 2 contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions Phase 2 detail/edit/evidence remediation applied.')
