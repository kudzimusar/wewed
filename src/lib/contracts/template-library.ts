import { createHash } from 'node:crypto'
import { db } from '@/lib/db'

export type ContractTemplatePack = {
  code: string
  title: string
  serviceCategory: string
  semanticVersion: string
  marketCode: string
  summary: string
  clauses: Array<{
    code: string
    title: string
    family: string
    body: string
  }>
}

const COMMON_CLAUSES: ContractTemplatePack['clauses'] = [
  {
    code: 'PARTIES_AUTHORITY',
    title: 'Parties and authority',
    family: 'parties',
    body: 'The people and organisations shown in the agreement are the recorded participants for this service engagement. Any representative acts only within the authority expressly recorded in Wewed.',
  },
  {
    code: 'SCOPE_SERVICE',
    title: 'Scope of service',
    family: 'scope',
    body: 'The service provider will deliver the service scope, dates, locations and deliverables stated in the agreement. Material additions or removals must be recorded through the governed Wewed change process.',
  },
  {
    code: 'PRICE_PAYMENT',
    title: 'Price and payment record',
    family: 'payment',
    body: 'The commercial amount and currency are those stated in the agreement. Payment milestones, invoices, receipts and proof are operational records linked to the Service Engagement and must not silently change the agreed scope.',
  },
  {
    code: 'COOPERATION_ACCESS',
    title: 'Cooperation and access',
    family: 'responsibilities',
    body: 'Each participant will provide the information, decisions, access and reasonable cooperation required for the service to be delivered as recorded.',
  },
  {
    code: 'CHANGE_CONTROL',
    title: 'Changes',
    family: 'changes',
    body: 'A material change to price, scope, date, payment terms, cancellation terms or material obligations must be documented as a new governed contract version rather than editing an issued version in place.',
  },
  {
    code: 'CANCELLATION_POSTPONEMENT',
    title: 'Cancellation and postponement',
    family: 'cancellation',
    body: 'Any cancellation, postponement, credit or refund position must be recorded against the engagement and supported by the applicable agreement terms and evidence. Wewed does not automatically decide liability or seize funds.',
  },
  {
    code: 'DELAYS_NONPERFORMANCE',
    title: 'Delays and non-performance',
    family: 'performance',
    body: 'A reported delay, no-show or non-performance event may be recorded as a possible issue with supporting evidence. Recording an issue does not by itself determine breach, liability or remedy.',
  },
  {
    code: 'FORCE_MAJEURE',
    title: 'Events beyond reasonable control',
    family: 'performance',
    body: 'Where an event outside a participant’s reasonable control materially affects delivery, the participants should record the event, its effect and any agreed revised arrangement through Wewed.',
  },
  {
    code: 'COMMUNICATION_EVIDENCE',
    title: 'Notices, communications and records',
    family: 'evidence',
    body: 'Wewed may preserve agreement versions, operational messages, documents, payment evidence and change records for the engagement subject to Wewed access, privacy and retention policies. External messages remain delivery channels; the governed Wewed record is authoritative for Wewed workflow state.',
  },
  {
    code: 'DISPUTE_ESCALATION',
    title: 'Issues and dispute escalation',
    family: 'disputes',
    body: 'Participants should first record the issue, relevant agreement term, requested outcome and supporting evidence. Wewed may support the workflow within its platform role but does not automatically adjudicate the underlying legal dispute.',
  },
  {
    code: 'WEWED_PLATFORM_ROLE',
    title: 'Wewed platform role',
    family: 'platform',
    body: 'Wewed provides the workflow, record, template and communication infrastructure. Wewed is not automatically the service provider, client, merchant of record, escrow holder, guarantor or commercial obligor unless a separate written arrangement expressly says otherwise.',
  },
]

const SPECIALISTS: Record<string, ContractTemplatePack['clauses']> = {
  Photography: [{ code: 'PHOTO_DELIVERABLES', title: 'Photography deliverables', family: 'service_specific', body: 'The agreement should state coverage times, principal deliverables, delivery method, expected delivery timing and any expressly agreed usage or editing parameters.' }],
  Videography: [{ code: 'VIDEO_DELIVERABLES', title: 'Videography deliverables', family: 'service_specific', body: 'The agreement should state coverage times, principal films or clips, delivery method, expected delivery timing and any expressly agreed editing or format parameters.' }],
  Venue: [{ code: 'VENUE_ACCESS', title: 'Venue access and use', family: 'service_specific', body: 'The agreement should state the booked spaces, access window, event window, capacity assumptions, included facilities and any setup or restoration responsibilities.' }],
  Catering: [{ code: 'CATERING_SERVICE', title: 'Catering service details', family: 'service_specific', body: 'The agreement should state estimated guest count, menu/service format, dietary information supplied, staffing assumptions, service times and final-count deadlines.' }],
  Decor: [{ code: 'DECOR_INSTALL', title: 'Decor installation and removal', family: 'service_specific', body: 'The agreement should state principal styling deliverables, installation and removal windows, venue access assumptions, hired-item responsibilities and approved substitutions.' }],
  Florist: [{ code: 'FLORAL_SPECIFICATION', title: 'Floral specification', family: 'service_specific', body: 'The agreement should state principal floral items, installation timing, approved substitution approach where supply changes, collection/removal obligations and hired-vessel responsibilities.' }],
  'DJ / Entertainment': [{ code: 'ENTERTAINMENT_SERVICE', title: 'Entertainment performance', family: 'service_specific', body: 'The agreement should state performance windows, equipment and power assumptions, setup/sound-check timing, requested programme constraints and any agreed overtime basis.' }],
  Cake: [{ code: 'CAKE_DELIVERY', title: 'Cake specification and delivery', family: 'service_specific', body: 'The agreement should state size/servings, principal design specification, flavour/allergen information supplied, delivery/setup responsibility and delivery window.' }],
  'Hair / Makeup': [{ code: 'BEAUTY_SERVICE', title: 'Beauty service schedule', family: 'service_specific', body: 'The agreement should state the people receiving services, agreed service types, preparation/start times, trial arrangements where applicable and venue/travel assumptions.' }],
  Transport: [{ code: 'TRANSPORT_SERVICE', title: 'Transport service', family: 'service_specific', body: 'The agreement should state vehicle/service type, passenger assumptions, pickup and drop-off points, timing windows and agreed waiting/overtime arrangements.' }],
  'Planner / Coordinator': [{ code: 'PLANNER_SCOPE', title: 'Planning and coordination scope', family: 'service_specific', body: 'The agreement should state planning or coordination coverage, included meetings/deliverables, event-day presence, decision/approval boundaries and excluded third-party obligations.' }],
  Rentals: [{ code: 'RENTAL_ITEMS', title: 'Rental items and return', family: 'service_specific', body: 'The agreement should state hired items and quantities, delivery/collection windows, installation responsibilities, condition/return expectations and any documented loss or damage process.' }],
  Custom: [{ code: 'CUSTOM_SERVICE', title: 'Custom service specification', family: 'service_specific', body: 'The agreement should describe the custom service and measurable deliverables clearly enough for participants to understand what is and is not included.' }],
}

export const TEMPLATE_CATEGORIES = [
  'Planner / Coordinator', 'Venue', 'Catering', 'Photography', 'Videography', 'Decor', 'Florist',
  'DJ / Entertainment', 'Cake', 'Hair / Makeup', 'Transport', 'Accommodation', 'Officiant', 'Rentals',
  'Lighting / AV / Production', 'Security', 'Printing / Stationery / Signage', 'Content Creator',
  'Bar / Beverages', 'Photo Booth', 'Childcare', 'Gifts / Favours', 'Custom',
] as const

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function specialistClause(category: string): ContractTemplatePack['clauses'] {
  if (SPECIALISTS[category]) return SPECIALISTS[category]
  return [{
    code: `SERVICE_${category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
    title: `${category} service details`,
    family: 'service_specific',
    body: `The agreement should state the principal ${category.toLowerCase()} deliverables, timing, access assumptions, included resources and any material exclusions or substitutions.`,
  }]
}

export function getWewedTemplatePack(serviceCategory: string): ContractTemplatePack {
  const normalized = TEMPLATE_CATEGORIES.includes(serviceCategory as (typeof TEMPLATE_CATEGORIES)[number])
    ? serviceCategory
    : 'Custom'
  const code = `WEWED_${normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
  return {
    code,
    title: normalized === 'Custom' ? 'Wewed Standard Service Agreement' : `Wewed Standard ${normalized} Agreement`,
    serviceCategory: normalized,
    semanticVersion: '1.0.0',
    marketCode: 'GLOBAL',
    summary: 'Wewed operator-review template. Jurisdiction-specific enforceability is not claimed until qualified legal review is recorded.',
    clauses: [...COMMON_CLAUSES, ...specialistClause(normalized)],
  }
}

export async function ensureWewedContractTemplate(serviceCategory: string) {
  const pack = getWewedTemplatePack(serviceCategory)
  const clauseRecords = []
  for (const clause of pack.clauses) {
    const contentHash = sha256(JSON.stringify({ title: clause.title, family: clause.family, body: clause.body }))
    const existing = await db.contractClause.findUnique({ where: { code_version: { code: clause.code, version: pack.semanticVersion } } })
    if (existing && existing.contentHash !== contentHash) {
      throw new Error(`Contract clause ${clause.code}@${pack.semanticVersion} is immutable; publish a new version.`)
    }
    clauseRecords.push(existing ?? await db.contractClause.create({
      data: {
        code: clause.code,
        version: pack.semanticVersion,
        title: clause.title,
        clauseFamily: clause.family,
        body: clause.body,
        status: 'internal_review',
        reviewStatus: 'operator_review',
        contentHash,
      },
    }))
  }

  const templateHash = sha256(JSON.stringify({
    code: pack.code,
    title: pack.title,
    serviceCategory: pack.serviceCategory,
    semanticVersion: pack.semanticVersion,
    marketCode: pack.marketCode,
    clauses: clauseRecords.map((clause) => ({ code: clause.code, version: clause.version, hash: clause.contentHash })),
  }))
  const existingTemplate = await db.contractTemplate.findUnique({
    where: { code_semanticVersion_marketCode: { code: pack.code, semanticVersion: pack.semanticVersion, marketCode: pack.marketCode } },
    include: { clauses: true },
  })
  if (existingTemplate && existingTemplate.templateHash !== templateHash) {
    throw new Error(`Contract template ${pack.code}@${pack.semanticVersion} is immutable; publish a new semantic version.`)
  }
  const template = existingTemplate ?? await db.contractTemplate.create({
    data: {
      code: pack.code,
      title: pack.title,
      serviceCategory: pack.serviceCategory,
      semanticVersion: pack.semanticVersion,
      marketCode: pack.marketCode,
      status: 'internal_review',
      reviewStatus: 'operator_review',
      summary: pack.summary,
      templateHash,
    },
    include: { clauses: true },
  })

  const existingClauseIds = new Set(template.clauses.map((item) => item.clauseId))
  for (let position = 0; position < clauseRecords.length; position += 1) {
    const clause = clauseRecords[position]
    if (existingClauseIds.has(clause.id)) continue
    await db.contractTemplateClause.create({
      data: { templateId: template.id, clauseId: clause.id, position, required: true },
    })
  }

  return db.contractTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: { clauses: { include: { clause: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
  })
}
