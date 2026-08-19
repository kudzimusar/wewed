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


# Direct-vendor support is anchored to a Service Engagement from pledge onward. The vendor/payment fact can never
# be reconstructed later from free text or a generic contribution transition.
route = 'src/app/api/planner/contributions/route.ts'
replace_once(
    route,
    "      if (directPayment && fulfillmentState === 'PAID_DIRECT' && !serviceEngagementId) throw new Error('DIRECT_PAYMENT_ENGAGEMENT_REQUIRED')",
    "      if (directPayment && !serviceEngagementId) throw new Error('DIRECT_PAYMENT_ENGAGEMENT_REQUIRED')",
)
replace_once(
    route,
    "      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null\n",
    """      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null
      if (fulfilledAt && Number.isNaN(fulfilledAt.getTime())) throw new Error('INVALID_FULFILLED_DATE')
      if (pledgedAt && Number.isNaN(pledgedAt.getTime())) throw new Error('INVALID_PLEDGED_DATE')
      if (expectedAt && Number.isNaN(expectedAt.getTime())) throw new Error('INVALID_EXPECTED_DATE')
""",
)
replace_once(
    route,
    "      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'A direct vendor payment must be connected to the vendor service engagement.',",
    """      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'Direct vendor support must be connected to the vendor service engagement from the pledge onward.',
      INVALID_FULFILLED_DATE: 'Use a valid fulfilled date.',
      INVALID_PLEDGED_DATE: 'Use a valid pledged date.',
      INVALID_EXPECTED_DATE: 'Use a valid expected date.',""",
)

detail = 'src/app/api/planner/contributions/[id]/route.ts'
replace_once(
    detail,
    """    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && (body.amount !== undefined || body.currency !== undefined)) {
      return NextResponse.json({ success: false, error: 'For a promised direct vendor payment, delete and recreate the pledge to change its amount or currency before payment.' }, { status: 409 })
    }
""",
    """    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.type !== undefined && body.type !== 'DIRECT_VENDOR_PAYMENT') {
      return NextResponse.json({ success: false, error: 'A direct vendor contribution cannot be changed into another contribution type. Preserve the payment trail and create a separate record if needed.' }, { status: 409 })
    }
    if (current.type !== 'DIRECT_VENDOR_PAYMENT' && body.type === 'DIRECT_VENDOR_PAYMENT') {
      return NextResponse.json({ success: false, error: 'Direct vendor support must be created through the Service Engagement-aware direct-payment flow.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.fulfillmentState !== undefined) {
      return NextResponse.json({ success: false, error: 'Direct vendor fulfillment is controlled by the vendor-payment action so the real EngagementPayment and funding attribution stay atomic.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && (body.amount !== undefined || body.currency !== undefined)) {
      return NextResponse.json({ success: false, error: 'For a promised direct vendor payment, delete and recreate the pledge to change its amount or currency before payment.' }, { status: 409 })
    }
""",
)

# Campaign publication dates and recognition flags fail closed at creation rather than relying on SQL/date coercion.
campaign = 'src/app/api/planner/contribution-campaigns/route.ts'
replace_once(
    campaign,
    "for (const field of ['published','showTarget','showRaised','invitationVisible']) {",
    "for (const field of ['published','showTarget','showRaised','invitationVisible','showContributorRecognition']) {",
)
replace_once(
    campaign,
    """    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    const id = contributionId()
    const currency = normalizeCurrency(body.currency)
""",
    """    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    const publishFrom = body.publishFrom ? new Date(String(body.publishFrom)) : null
    const publishUntil = body.publishUntil ? new Date(String(body.publishUntil)) : null
    if (publishFrom && Number.isNaN(publishFrom.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication start.' }, { status:400 })
    if (publishUntil && Number.isNaN(publishUntil.getTime())) return NextResponse.json({ success:false, error:'Use a valid publication end.' }, { status:400 })
    if (publishFrom && publishUntil && publishUntil < publishFrom) return NextResponse.json({ success:false, error:'Publication end must be after its start.' }, { status:400 })
    const id = contributionId()
    const currency = normalizeCurrency(body.currency)
""",
)
replace_once(
    campaign,
    "${Boolean(body.showContributorRecognition)}, ${body.publishFrom ? new Date(String(body.publishFrom)) : null}, ${body.publishUntil ? new Date(String(body.publishUntil)) : null},",
    "${Boolean(body.showContributorRecognition)}, ${publishFrom}, ${publishUntil},",
)

# The old privacy contract pre-dated explicit contributor recognition. Replace it with the stronger double-consent rule:
# no contact details or individual amounts are ever public; names require both campaign and contributor consent.
contract = 'src/lib/contributions-source-contract.test.ts'
old_privacy = """  test('public campaign endpoint never selects contributor identity', () => {
    const publicRoute = read('src/app/api/contribution-campaigns/public/route.ts')
    expect(publicRoute).not.toContain('display_name')
    expect(publicRoute).not.toContain('email')
    expect(publicRoute).toContain('invitation_visible')
  })
"""
new_privacy = """  test('public recognition is double-consent and never exposes contributor contact or individual financial detail', () => {
    const publicRoute = read('src/app/api/contribution-campaigns/public/route.ts')
    expect(publicRoute).toContain('show_contributor_recognition')
    expect(publicRoute).toContain('p.public_recognition=TRUE')
    expect(publicRoute).toContain('p.anonymous_public=FALSE')
    expect(publicRoute).toContain('p.display_name')
    expect(publicRoute).not.toContain('p.email')
    expect(publicRoute).not.toContain('p.phone')
    expect(publicRoute).not.toContain('p.address')
    expect(publicRoute).toContain('invitation_visible')
    expect(publicRoute).not.toContain('contributorAmount')
  })
"""
replace_once(contract, old_privacy, new_privacy)

insert = """
  test('direct vendor support cannot bypass Service Engagement or atomic payment fulfillment', () => {
    const create = read('src/app/api/planner/contributions/route.ts')
    const detail = read('src/app/api/planner/contributions/[id]/route.ts')
    const actions = read('src/app/api/planner/contributions/[id]/actions/route.ts')
    expect(create).toContain("if (directPayment && !serviceEngagementId)")
    expect(detail).toContain('Direct vendor fulfillment is controlled by the vendor-payment action')
    expect(detail).toContain('Direct vendor support must be created through the Service Engagement-aware direct-payment flow')
    expect(actions).toContain("action === 'mark-direct-paid'")
    expect(actions).toContain('engagementPayment.create')
  })

  test('optional contribution and campaign dates are validated before persistence', () => {
    const create = read('src/app/api/planner/contributions/route.ts')
    const campaign = read('src/app/api/planner/contribution-campaigns/route.ts')
    expect(create).toContain('INVALID_EXPECTED_DATE')
    expect(create).toContain('INVALID_PLEDGED_DATE')
    expect(create).toContain('INVALID_FULFILLED_DATE')
    expect(campaign).toContain('Publication end must be after its start.')
    expect(campaign).toContain("'showContributorRecognition'")
  })
"""
needle = "\n  test('public recognition is double-consent and never exposes contributor contact or individual financial detail', () => {"
text = read(contract)
if text.count(needle) != 1:
    raise SystemExit('final invariant contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions final cross-phase invariants applied.')
