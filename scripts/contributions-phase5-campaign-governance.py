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


# Optional public identity is doubly gated: campaign opt-in + contributor consent. Default remains private.
write(
    'prisma/migrations/20260819191000_contribution_campaign_recognition_privacy/migration.sql',
    """ALTER TABLE wewed_contributions.campaigns
  ADD COLUMN IF NOT EXISTS show_contributor_recognition BOOLEAN NOT NULL DEFAULT FALSE;
""",
)

store = 'src/lib/contributions/store.ts'
replace_once(store, "  invitationVisible: boolean\n  publicNote:", "  invitationVisible: boolean\n  showContributorRecognition: boolean\n  publicNote:")
replace_once(
    store,
    "           invitation_visible AS \"invitationVisible\", public_note AS \"publicNote\",",
    "           invitation_visible AS \"invitationVisible\", show_contributor_recognition AS \"showContributorRecognition\", public_note AS \"publicNote\",",
)
replace_once(
    store,
    "    invitationVisible: row.invitationVisible,\n    publicNote:",
    "    invitationVisible: row.invitationVisible,\n    showContributorRecognition: row.showContributorRecognition,\n    publicNote:",
)

# Campaign create supports full private configuration but never silently publishes it.
create_route = 'src/app/api/planner/contribution-campaigns/route.ts'
replace_once(
    create_route,
    "        (id, wedding_id, type, title, description, target_amount, currency, published, show_target, show_raised, external_url, cta_label, invitation_visible, public_note)",
    "        (id, wedding_id, type, title, description, target_amount, currency, published, show_target, show_raised, external_url, cta_label, invitation_visible, show_contributor_recognition, publish_from, publish_until, public_note)",
)
replace_once(
    create_route,
    "(${id}, ${weddingId}, ${type}, ${title}, ${String(body.description ?? '').trim() || null}, ${targetAmount}, ${currency}, ${Boolean(body.published)}, ${Boolean(body.showTarget)}, ${Boolean(body.showRaised)}, ${externalUrl}, ${String(body.ctaLabel ?? '').trim() || null}, ${Boolean(body.invitationVisible)}, ${String(body.publicNote ?? '').trim() || null})",
    "(${id}, ${weddingId}, ${type}, ${title}, ${String(body.description ?? '').trim() || null}, ${targetAmount}, ${currency}, ${Boolean(body.published)}, ${Boolean(body.showTarget)}, ${Boolean(body.showRaised)}, ${externalUrl}, ${String(body.ctaLabel ?? '').trim() || null}, ${Boolean(body.invitationVisible)}, ${Boolean(body.showContributorRecognition)}, ${body.publishFrom ? new Date(String(body.publishFrom)) : null}, ${body.publishUntil ? new Date(String(body.publishUntil)) : null}, ${String(body.publicNote ?? '').trim() || null})",
)

# Campaign PATCH exposes the canonical full detail controls, validates dates, and preserves currency lock.
patch_route = 'src/app/api/planner/contribution-campaigns/[id]/route.ts'
replace_once(
    patch_route,
    "import { finiteNonNegative, isCurrencyCode, normalizeCurrency } from '@/lib/contributions'",
    "import { finiteNonNegative, isCurrencyCode, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'",
)
replace_once(
    patch_route,
    "    const title = typeof body.title === 'string' ? body.title.trim() : null\n",
    """    const title = typeof body.title === 'string' ? body.title.trim() : null
    const type = body.type === undefined ? null : normalizeContributionCampaignType(body.type)
    if (body.type !== undefined && !type) return NextResponse.json({ success:false, error:'Choose a valid contribution campaign type.' }, { status:400 })
""",
)
replace_once(
    patch_route,
    "    const invitationVisible = typeof body.invitationVisible === 'boolean' ? body.invitationVisible : null\n",
    """    const invitationVisible = typeof body.invitationVisible === 'boolean' ? body.invitationVisible : null
    const showContributorRecognition = typeof body.showContributorRecognition === 'boolean' ? body.showContributorRecognition : null
    const publishFrom = body.publishFrom === undefined ? undefined : body.publishFrom ? new Date(String(body.publishFrom)) : null
    const publishUntil = body.publishUntil === undefined ? undefined : body.publishUntil ? new Date(String(body.publishUntil)) : null
    if (publishFrom instanceof Date && Number.isNaN(publishFrom.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication start.' }, { status:400 })
    if (publishUntil instanceof Date && Number.isNaN(publishUntil.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication end.' }, { status:400 })
    if (publishFrom && publishUntil && publishUntil < publishFrom) return NextResponse.json({ success:false, error:'Publication end must be after its start.' }, { status:400 })
""",
)
replace_once(
    patch_route,
    "         SET title = COALESCE(${title}, title),",
    "         SET type = COALESCE(${type}, type),\n             title = COALESCE(${title}, title),",
)
replace_once(
    patch_route,
    "             invitation_visible = COALESCE(${invitationVisible}, invitation_visible),\n             updated_at = NOW()",
    """             invitation_visible = COALESCE(${invitationVisible}, invitation_visible),
             show_contributor_recognition = COALESCE(${showContributorRecognition}, show_contributor_recognition),
             publish_from = CASE WHEN ${body.publishFrom !== undefined} THEN ${publishFrom} ELSE publish_from END,
             publish_until = CASE WHEN ${body.publishUntil !== undefined} THEN ${publishUntil} ELSE publish_until END,
             updated_at = NOW()""",
)

# Canonical share path uses the existing public wedding route and Registry anchor.
write(
    'src/app/api/planner/contribution-campaigns/share/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\nexport async function GET(request:NextRequest) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const wedding = await db.wedding.findUnique({ where:{ id:access.context.weddingId }, select:{ slug:true } })\n  if (!wedding?.slug) return NextResponse.json({ success:false, error:'This wedding does not have a public slug yet.' }, { status:409 })\n  return NextResponse.json({ success:true, data:{ path:`/w/${encodeURIComponent(wedding.slug)}#registry` } })\n}\n""",
)

# Public endpoint returns consented names only when the campaign explicitly opts in; individual amounts remain private.
public_route = 'src/app/api/contribution-campaigns/public/route.ts'
replace_once(public_route, "      invitationVisible: boolean\n      publicNote:", "      invitationVisible: boolean\n      showContributorRecognition: boolean\n      publicNote:")
replace_once(
    public_route,
    "             camp.invitation_visible AS \"invitationVisible\", camp.public_note AS \"publicNote\",",
    "             camp.invitation_visible AS \"invitationVisible\", camp.show_contributor_recognition AS \"showContributorRecognition\", camp.public_note AS \"publicNote\",",
)
replace_once(
    public_route,
    "    const data = rows.map((row) => ({",
    """    const recognition = rows.some((row) => row.showContributorRecognition)
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
    const data = rows.map((row) => ({""",
)
replace_once(
    public_route,
    "      invitationVisible: row.invitationVisible,\n      publicNote: row.publicNote,",
    "      invitationVisible: row.invitationVisible,\n      publicNote: row.publicNote,\n      recognition: row.showContributorRecognition ? recognition.filter((item)=>item.campaignId===row.id).map((item)=>item.displayName) : [],",
)

# Public cards may acknowledge consented names, never individual amounts.
bridge = 'src/components/wedding/gift-registry-campaign-bridge.tsx'
replace_once(bridge, "  publicNote: string | null\n}", "  publicNote: string | null\n  recognition?: string[]\n}")
replace_once(
    bridge,
    "                {campaign.publicNote && <p className=\"mt-5 font-serif text-sm italic leading-6 text-espresso/55\">{campaign.publicNote}</p>}",
    "                {campaign.publicNote && <p className=\"mt-5 font-serif text-sm italic leading-6 text-espresso/55\">{campaign.publicNote}</p>}{campaign.recognition?.length ? <p className=\"mt-4 font-sans text-[11px] leading-5 text-espresso/45\">With thanks to {campaign.recognition.join(', ')}.</p> : null}",
)

# Planner campaign management exposes private detail controls, deliberate share link, and QR via the existing QR engine.
ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "interface Campaign { id: string; type: string; title: string; description: string | null; targetAmount: number | null; currency: string; published: boolean; showTarget: boolean; showRaised: boolean; externalUrl: string | null; ctaLabel: string | null; invitationVisible: boolean; publicNote: string | null; raised: number }",
    "interface Campaign { id: string; type: string; title: string; description: string | null; targetAmount: number | null; currency: string; published: boolean; showTarget: boolean; showRaised: boolean; externalUrl: string | null; ctaLabel: string | null; invitationVisible: boolean; showContributorRecognition:boolean; publicNote: string | null; publishFrom:string|null; publishUntil:string|null; raised: number }",
)
replace_once(
    ui,
    "  const [paymentFundingForm, setPaymentFundingForm] = useState({ sourceKind:'COUPLE', amount:'', contributionId:'', budgetItemId:'' })\n",
    "  const [paymentFundingForm, setPaymentFundingForm] = useState({ sourceKind:'COUPLE', amount:'', contributionId:'', budgetItemId:'' })\n  const [giftingShare, setGiftingShare] = useState<{url:string;qr:string}|null>(null)\n",
)
replace_once(
    ui,
    "  async function classifyFunding(item: FundingItem, sourceKind: 'COUPLE' | 'CONTRIBUTION') {",
    """  async function prepareGiftingShare() {
    try {
      const response = await fetch('/api/planner/contribution-campaigns/share', { cache:'no-store' })
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not create gifting link.')
      const url = `${window.location.origin}${body.data.path}`
      const qrResponse = await fetch(`/api/qrcode?data=${encodeURIComponent(url)}&size=260`, { cache:'no-store' })
      const qrBody = await qrResponse.json()
      if (!qrResponse.ok || !qrBody.qr) throw new Error(qrBody.error || 'Could not create gifting QR code.')
      setGiftingShare({ url, qr:qrBody.qr })
      await navigator.clipboard?.writeText(url).catch(()=>undefined)
      toast({ title:'Gifting link ready', description:'The public Registry link has also been copied when browser permissions allow.' })
    } catch (reason) { toast({ title:'Gifting link unavailable', description:reason instanceof Error ? reason.message : undefined, variant:'destructive' }) }
  }

  async function classifyFunding(item: FundingItem, sourceKind: 'COUPLE' | 'CONTRIBUTION') {""",
)
# Insert identity toggle + editable details + sharing controls after the existing campaign toggle button group.
replace_once(
    ui,
    "<Button size=\"sm\" variant=\"outline\" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})} className=\"border-gold/20 bg-transparent\">Target: {campaign.showTarget ? 'Shown' : 'Hidden'}</Button></div></div>)}</div> : null}</div><form onSubmit={createCampaign}",
    """<Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})} className="border-gold/20 bg-transparent">Target: {campaign.showTarget ? 'Shown' : 'Hidden'}</Button><Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showContributorRecognition:!campaign.showContributorRecognition})} className="border-gold/20 bg-transparent">Consented names: {campaign.showContributorRecognition ? 'Shown' : 'Private'}</Button></div><details className="mt-3 rounded-lg border border-gold/10"><summary className="cursor-pointer px-3 py-2 text-xs text-gold">Campaign details & publication window</summary><form onSubmit={(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);void patchCampaign(campaign,{type:String(data.get('type')||campaign.type),title:String(data.get('title')||campaign.title),description:String(data.get('description')||''),targetAmount:data.get('targetAmount')?Number(data.get('targetAmount')):null,externalUrl:String(data.get('externalUrl')||''),ctaLabel:String(data.get('ctaLabel')||''),publicNote:String(data.get('publicNote')||''),publishFrom:String(data.get('publishFrom')||''),publishUntil:String(data.get('publishUntil')||'')})}} className="grid gap-2 border-t border-gold/10 p-3 sm:grid-cols-2"><select name="type" defaultValue={campaign.type} className="h-10 rounded-md border border-gold/20 bg-espresso px-2 text-xs">{Object.entries(CONTRIBUTION_CAMPAIGN_TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><Input name="title" defaultValue={campaign.title} className="border-gold/20 bg-espresso/70"/><Input name="targetAmount" inputMode="decimal" defaultValue={campaign.targetAmount ?? ''} placeholder="Optional target" className="border-gold/20 bg-espresso/70"/><Input name="ctaLabel" defaultValue={campaign.ctaLabel ?? ''} placeholder="CTA label" className="border-gold/20 bg-espresso/70"/><Input name="externalUrl" defaultValue={campaign.externalUrl ?? ''} placeholder="HTTPS registry/payment link" className="border-gold/20 bg-espresso/70 sm:col-span-2"/><Textarea name="description" defaultValue={campaign.description ?? ''} placeholder="Public description" className="border-gold/20 bg-espresso/70 sm:col-span-2"/><Textarea name="publicNote" defaultValue={campaign.publicNote ?? ''} placeholder="Optional appreciative public note" className="border-gold/20 bg-espresso/70 sm:col-span-2"/><div><Label>Publish from</Label><Input name="publishFrom" type="datetime-local" defaultValue={campaign.publishFrom ? campaign.publishFrom.slice(0,16) : ''} className="mt-1 border-gold/20 bg-espresso/70"/></div><div><Label>Publish until</Label><Input name="publishUntil" type="datetime-local" defaultValue={campaign.publishUntil ? campaign.publishUntil.slice(0,16) : ''} className="mt-1 border-gold/20 bg-espresso/70"/></div><Button disabled={saving} className="bg-gold text-espresso sm:col-span-2">Save campaign details</Button></form></details></div>)}</div> : null}<div className="mt-4"><Button type="button" variant="outline" onClick={()=>void prepareGiftingShare()} className="border-gold/20 bg-transparent">Prepare public gifting link / QR</Button>{giftingShare && <div className="mt-3 grid gap-3 rounded-xl border border-gold/12 p-3 sm:grid-cols-[1fr_auto]"><div><p className="break-all text-xs text-gold">{giftingShare.url}</p><p className="mt-1 text-[10px] text-champagne/45">This opens the canonical public Registry section. Only published campaign fields are exposed.</p></div><img src={giftingShare.qr} alt="QR code for public gifting information" className="size-28 rounded bg-champagne p-1"/></div>}</div></div><form onSubmit={createCampaign}""",
)

# Contracts explicitly lock the privacy double-gate and canonical public route.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """
  test('Phase 5 campaign governance controls publication windows, canonical share paths, and double-gated recognition', () => {
    const patch = read('src/app/api/planner/contribution-campaigns/[id]/route.ts')
    const publicRoute = read('src/app/api/contribution-campaigns/public/route.ts')
    const share = read('src/app/api/planner/contribution-campaigns/share/route.ts')
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(patch).toContain('publish_from')
    expect(patch).toContain('show_contributor_recognition')
    expect(publicRoute).toContain('p.public_recognition=TRUE')
    expect(publicRoute).toContain('p.anonymous_public=FALSE')
    expect(share).toContain('/w/${encodeURIComponent(wedding.slug)}#registry')
    expect(ui).toContain('Prepare public gifting link / QR')
    expect(ui).toContain('Consented names:')
  })
"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('Phase 5 contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions Phase 5 campaign governance remediation applied.')
