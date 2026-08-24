import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { BookingCommerceError } from '@/lib/booking-commerce'

type QueryClient = Pick<Prisma.TransactionClient, '$queryRawUnsafe' | '$executeRawUnsafe'>
type AllocationState = 'hold' | 'confirmed'

type ItemPolicy = {
  id: string
  bookingArchetype: string
  bookingMode: string
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minNoticeMinutes: number | null
  bookingHorizonDays: number | null
  minDurationMinutes: number | null
  maxDurationMinutes: number | null
  operatingTimezone: string | null
  availabilityPolicy: unknown
  serviceAreaPolicy: unknown
}

type Component = {
  id: string
  childCatalogItemId: string
  childVariantId: string | null
  componentKind: 'package' | 'addon'
  selectionKey: string | null
  quantity: number
  isOptional: boolean
  metadata: unknown
}

type ResourceCandidate = {
  id: string
  capacity: number
  occupied: bigint
  blocked: boolean
  effectiveCapacity: number
  weeklyConfigured: boolean
  weeklyAllowed: boolean
  windowConfigured: boolean
  windowAllowed: boolean
}

type AvailabilityInput = {
  itemId: string
  variantId?: string | null
  quantity?: number
  startsAt: Date
  endsAt: Date
  serviceLocation?: string | null
  selectedAddOns?: string[]
  excludeBookingId?: string | null
  now?: Date
}

type AllocationInput = {
  tx: Prisma.TransactionClient
  bookingId: string
  bookingLineId: string
  catalogItemId: string
  variantId: string | null
  quantity: number
  selectedOptions?: unknown
  startsAt: Date
  endsAt: Date
  state: AllocationState
  holdId: string | null
  expiresAt: Date | null
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean) : []
}

function positiveQuantity(value: unknown): number {
  const parsed = Number(value ?? 1)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BookingCommerceError('Quantity must be a positive whole number.', 400, 'INVALID_QUANTITY')
  return parsed
}

async function itemPolicy(client: QueryClient, itemId: string): Promise<ItemPolicy> {
  const rows = await client.$queryRawUnsafe<ItemPolicy[]>(
    `SELECT id,"bookingArchetype","bookingMode","bufferBeforeMinutes","bufferAfterMinutes",
            "minNoticeMinutes","bookingHorizonDays","minDurationMinutes","maxDurationMinutes",
            "operatingTimezone","availabilityPolicy","serviceAreaPolicy"
       FROM wewed_booking."ProviderCatalogItem"
      WHERE id=$1 AND status='published' LIMIT 1`,
    itemId,
  )
  const item = rows[0]
  if (!item) throw new BookingCommerceError('This bookable item is unavailable.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return item
}

async function validateVariant(client: QueryClient, itemId: string, variantId: string | null | undefined) {
  if (!variantId) return
  const rows = await client.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM wewed_booking."ProviderCatalogVariant" WHERE id=$1 AND "catalogItemId"=$2 AND status='active' LIMIT 1`,
    variantId,
    itemId,
  )
  if (!rows[0]) throw new BookingCommerceError('The selected option is unavailable.', 404, 'VARIANT_NOT_FOUND')
}

async function timezoneExists(client: QueryClient, timezone: string) {
  const rows = await client.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=$1) AS ok`,
    timezone,
  )
  return Boolean(rows[0]?.ok)
}

function policyNumber(item: ItemPolicy, columnValue: number | null, key: string): number | null {
  if (columnValue != null) return columnValue
  const raw = object(item.availabilityPolicy)[key]
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function validateServiceArea(item: ItemPolicy, serviceLocation?: string | null) {
  const availability = object(item.availabilityPolicy)
  const embedded = object(availability.serviceArea)
  const policy = { ...embedded, ...object(item.serviceAreaPolicy) }
  const mode = typeof policy.mode === 'string' ? policy.mode : 'none'
  if (mode === 'none') return { allowed: true, reason: 'NOT_CONFIGURED' }
  const required = policy.required === true
  const location = serviceLocation?.trim() || ''
  if (required && !location) return { allowed: false, reason: 'SERVICE_LOCATION_REQUIRED' }
  if (!location) return { allowed: true, reason: 'LOCATION_NOT_SUPPLIED' }
  if (mode === 'text_allowlist') {
    const terms = stringArray(policy.allowedTerms).map((entry) => entry.toLocaleLowerCase())
    if (!terms.length) return { allowed: false, reason: 'SERVICE_AREA_CONFIGURATION_INVALID' }
    const normalized = location.toLocaleLowerCase()
    return terms.some((term) => normalized.includes(term))
      ? { allowed: true, reason: 'SERVICE_AREA_MATCH' }
      : { allowed: false, reason: 'OUTSIDE_SERVICE_AREA' }
  }
  return { allowed: true, reason: 'SERVICE_AREA_VENDOR_CONFIRMATION' }
}

async function validatePolicyWindow(client: QueryClient, item: ItemPolicy, startsAt: Date, endsAt: Date, serviceLocation?: string | null, now = new Date()) {
  if (!(endsAt > startsAt)) throw new BookingCommerceError('End time must be after start time.', 400, 'INVALID_TIME_RANGE')
  const durationMinutes = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000)
  const minNotice = policyNumber(item, item.minNoticeMinutes, 'minNoticeMinutes')
  const horizon = policyNumber(item, item.bookingHorizonDays, 'bookingHorizonDays')
  const minDuration = policyNumber(item, item.minDurationMinutes, 'minDurationMinutes')
  const maxDuration = policyNumber(item, item.maxDurationMinutes, 'maxDurationMinutes')

  if (minNotice != null && startsAt.getTime() < now.getTime() + minNotice * 60_000) {
    return { allowed: false, reason: 'MINIMUM_NOTICE', durationMinutes }
  }
  if (horizon != null && startsAt.getTime() > now.getTime() + horizon * 86_400_000) {
    return { allowed: false, reason: 'BOOKING_HORIZON', durationMinutes }
  }
  if (minDuration != null && durationMinutes < minDuration) {
    return { allowed: false, reason: 'MINIMUM_DURATION', durationMinutes }
  }
  if (maxDuration != null && durationMinutes > maxDuration) {
    return { allowed: false, reason: 'MAXIMUM_DURATION', durationMinutes }
  }
  const area = validateServiceArea(item, serviceLocation)
  if (!area.allowed) return { allowed: false, reason: area.reason, durationMinutes }
  if (item.operatingTimezone && !(await timezoneExists(client, item.operatingTimezone))) {
    return { allowed: false, reason: 'OPERATING_TIMEZONE_INVALID', durationMinutes }
  }
  return { allowed: true, reason: 'POLICY_OK', durationMinutes }
}

async function componentsFor(client: QueryClient, parentItemId: string, selectedAddOns: string[]): Promise<Component[]> {
  return client.$queryRawUnsafe<Component[]>(
    `SELECT id,"childCatalogItemId","childVariantId","componentKind","selectionKey",quantity,"isOptional",metadata
       FROM wewed_booking."ProviderCatalogComponent"
      WHERE "parentCatalogItemId"=$1 AND status='active'
        AND (("componentKind"='package' AND "isOptional"=false)
          OR ("componentKind"='addon' AND "selectionKey"=ANY($2::text[])))
      ORDER BY "componentKind",id`,
    parentItemId,
    selectedAddOns,
  )
}

async function resourceCandidates(client: QueryClient, item: ItemPolicy, variantId: string | null | undefined, startsAt: Date, endsAt: Date, excludeBookingId?: string | null): Promise<ResourceCandidate[]> {
  const timezone = item.operatingTimezone || 'UTC'
  return client.$queryRawUnsafe<ResourceCandidate[]>(
    `SELECT r.id,r.capacity,
            COALESCE((SELECT SUM(a.quantity)::bigint
                        FROM wewed_booking."BookingResourceAllocation" a
                       WHERE a."resourceId"=r.id
                         AND ($5::text IS NULL OR a."bookingId"<>$5)
                         AND a.state IN ('hold','confirmed')
                         AND (a.state='confirmed' OR a."expiresAt">CURRENT_TIMESTAMP)
                         AND a."startsAt"<$4 AND a."endsAt">$3),0::bigint) AS occupied,
            EXISTS(SELECT 1 FROM wewed_booking."AvailabilityRule" ar
                    WHERE ar."resourceId"=r.id AND ar."ruleType"='blackout'
                      AND ar."startsAt" IS NOT NULL AND ar."endsAt" IS NOT NULL
                      AND ar."startsAt"<$4 AND ar."endsAt">$3) AS blocked,
            LEAST(r.capacity,COALESCE((SELECT MIN(ar."capacityOverride")
                    FROM wewed_booking."AvailabilityRule" ar
                   WHERE ar."resourceId"=r.id AND ar."ruleType"='capacity_override'
                     AND (ar."startsAt" IS NULL OR ar."startsAt"<$4)
                     AND (ar."endsAt" IS NULL OR ar."endsAt">$3)),r.capacity))::integer AS "effectiveCapacity",
            EXISTS(SELECT 1 FROM wewed_booking."AvailabilityRule" ar WHERE ar."resourceId"=r.id AND ar."ruleType"='weekly') AS "weeklyConfigured",
            EXISTS(SELECT 1 FROM wewed_booking."AvailabilityRule" ar
                    WHERE ar."resourceId"=r.id AND ar."ruleType"='weekly'
                      AND ar."dayOfWeek"=EXTRACT(DOW FROM ($3 AT TIME ZONE $6))::integer
                      AND ar."startTime" IS NOT NULL AND ar."endTime" IS NOT NULL
                      AND ($3 AT TIME ZONE $6)::date=($4 AT TIME ZONE $6)::date
                      AND ($3 AT TIME ZONE $6)::time>=ar."startTime"
                      AND ($4 AT TIME ZONE $6)::time<=ar."endTime") AS "weeklyAllowed",
            EXISTS(SELECT 1 FROM wewed_booking."AvailabilityRule" ar WHERE ar."resourceId"=r.id AND ar."ruleType"='available_window') AS "windowConfigured",
            EXISTS(SELECT 1 FROM wewed_booking."AvailabilityRule" ar
                    WHERE ar."resourceId"=r.id AND ar."ruleType"='available_window'
                      AND ar."startsAt" IS NOT NULL AND ar."endsAt" IS NOT NULL
                      AND ar."startsAt"<=$3 AND ar."endsAt">=$4) AS "windowAllowed"
       FROM wewed_booking."BookingResource" r
      WHERE r."catalogItemId"=$1 AND r.status='active'
        AND ($2::text IS NULL OR r."variantId"=$2 OR r."variantId" IS NULL)
      ORDER BY CASE WHEN r."variantId"=$2 THEN 0 ELSE 1 END,r.id`,
    item.id,
    variantId ?? null,
    startsAt,
    endsAt,
    excludeBookingId ?? null,
    timezone,
  )
}

function candidateFree(candidate: ResourceCandidate) {
  if (candidate.blocked) return 0
  if (candidate.weeklyConfigured && !candidate.weeklyAllowed) return 0
  if (candidate.windowConfigured && !candidate.windowAllowed) return 0
  return Math.max(0, candidate.effectiveCapacity - Number(candidate.occupied))
}

function selectedAddOnsFromOptions(selectedOptions: unknown) {
  return stringArray(object(selectedOptions).addOns)
}

async function availabilityInternal(client: QueryClient, input: AvailabilityInput, visited: Set<string>, depth: number): Promise<Record<string, unknown>> {
  if (depth > 8 || visited.has(input.itemId)) throw new BookingCommerceError('Package configuration contains a circular dependency.', 409, 'PACKAGE_COMPONENT_CYCLE')
  const nextVisited = new Set(visited)
  nextVisited.add(input.itemId)
  const quantity = positiveQuantity(input.quantity)
  const item = await itemPolicy(client, input.itemId)
  await validateVariant(client, item.id, input.variantId ?? null)
  const policy = await validatePolicyWindow(client, item, input.startsAt, input.endsAt, input.serviceLocation, input.now)
  if (!policy.allowed) {
    return { state: 'unavailable', available: false, availableQuantity: 0, requestedQuantity: quantity, reason: policy.reason, checkedAt: new Date().toISOString(), provenance: { engine: 'booking-resource-engine-v1', policy: true } }
  }

  const bufferedStart = new Date(input.startsAt.getTime() - item.bufferBeforeMinutes * 60_000)
  const bufferedEnd = new Date(input.endsAt.getTime() + item.bufferAfterMinutes * 60_000)
  const direct = await resourceCandidates(client, item, input.variantId ?? null, bufferedStart, bufferedEnd, input.excludeBookingId)
  const directQuantity = direct.reduce((sum, entry) => sum + candidateFree(entry), 0)
  const selectedAddOns = input.selectedAddOns ?? []
  const components = await componentsFor(client, item.id, selectedAddOns)
  const packageComponents = components.filter((entry) => entry.componentKind === 'package')

  if (item.bookingArchetype === 'package' && packageComponents.length === 0) {
    return { state: 'unavailable', available: false, availableQuantity: 0, requestedQuantity: quantity, reason: 'PACKAGE_COMPONENTS_NOT_CONFIGURED', checkedAt: new Date().toISOString(), provenance: { engine: 'booking-resource-engine-v1', policy: true, packageComponents: 0 } }
  }

  let effectiveQuantity = direct.length ? directQuantity : Number.POSITIVE_INFINITY
  const componentEvidence: Array<Record<string, unknown>> = []
  for (const component of components) {
    const metadata = object(component.metadata)
    const perItem = metadata.quantityMode === 'per_item' || component.componentKind === 'package'
    const requiredForRequest = component.quantity * (perItem ? quantity : 1)
    const child = await availabilityInternal(client, {
      itemId: component.childCatalogItemId,
      variantId: component.childVariantId,
      quantity: requiredForRequest,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      serviceLocation: input.serviceLocation,
      selectedAddOns: [],
      excludeBookingId: input.excludeBookingId,
      now: input.now,
    }, nextVisited, depth + 1)
    const childAvailableQuantity = Number(child.availableQuantity ?? 0)
    const parentCapacity = perItem ? Math.floor(childAvailableQuantity / component.quantity) : (childAvailableQuantity >= component.quantity ? Number.MAX_SAFE_INTEGER : 0)
    effectiveQuantity = Math.min(effectiveQuantity, parentCapacity)
    componentEvidence.push({ componentId: component.id, kind: component.componentKind, childCatalogItemId: component.childCatalogItemId, requiredQuantity: requiredForRequest, available: child.available, reason: child.reason })
  }

  if (!direct.length && !components.length) {
    return {
      state: item.bookingMode === 'instant' ? 'unavailable' : 'request_only',
      available: false,
      availableQuantity: 0,
      requestedQuantity: quantity,
      reason: item.bookingMode === 'instant' ? 'NO_CONFIGURED_RESOURCE' : 'VENDOR_CONFIRMATION_REQUIRED',
      checkedAt: new Date().toISOString(),
      provenance: { engine: 'booking-resource-engine-v1', policy: true },
    }
  }

  if (!Number.isFinite(effectiveQuantity)) effectiveQuantity = directQuantity
  const available = effectiveQuantity >= quantity
  return {
    state: available ? 'available' : 'unavailable',
    available,
    availableQuantity: Math.max(0, effectiveQuantity),
    requestedQuantity: quantity,
    reason: available ? 'AVAILABLE' : 'CAPACITY_EXCEEDED',
    resourceIds: direct.filter((entry) => candidateFree(entry) > 0).map((entry) => entry.id),
    componentEvidence,
    bufferedStart: bufferedStart.toISOString(),
    bufferedEnd: bufferedEnd.toISOString(),
    checkedAt: new Date().toISOString(),
    provenance: { engine: 'booking-resource-engine-v1', policy: true, operatingTimezone: item.operatingTimezone || 'UTC', packageComponents: packageComponents.length },
  }
}

export async function checkDeterministicAvailability(input: AvailabilityInput) {
  return availabilityInternal(db as unknown as QueryClient, input, new Set<string>(), 0)
}

async function allocateDirect(client: QueryClient, input: AllocationInput, item: ItemPolicy, variantId: string | null, quantity: number, startsAt: Date, endsAt: Date) {
  const resources = await resourceCandidates(client, item, variantId, startsAt, endsAt, input.bookingId)
  let remaining = quantity
  for (const resource of resources) {
    if (remaining <= 0) break
    await client.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, resource.id)
    const refreshed = await resourceCandidates(client, item, variantId, startsAt, endsAt, input.bookingId)
    const same = refreshed.find((entry) => entry.id === resource.id)
    const free = same ? candidateFree(same) : 0
    if (free <= 0) continue
    const take = Math.min(free, remaining)
    await client.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingResourceAllocation"
       (id,"bookingId","bookingLineId","holdId","resourceId",quantity,"startsAt","endsAt",state,"expiresAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      randomUUID(), input.bookingId, input.bookingLineId, input.holdId, resource.id, take, startsAt, endsAt, input.state, input.expiresAt,
    )
    remaining -= take
  }
  return remaining
}

async function allocateInternal(input: AllocationInput, visited: Set<string>, depth: number): Promise<boolean> {
  if (depth > 8 || visited.has(input.catalogItemId)) throw new BookingCommerceError('Package configuration contains a circular dependency.', 409, 'PACKAGE_COMPONENT_CYCLE')
  const nextVisited = new Set(visited)
  nextVisited.add(input.catalogItemId)
  const item = await itemPolicy(input.tx, input.catalogItemId)
  await validateVariant(input.tx, item.id, input.variantId)
  const selectedAddOns = selectedAddOnsFromOptions(input.selectedOptions)
  const policy = await validatePolicyWindow(input.tx, item, input.startsAt, input.endsAt, null)
  if (!policy.allowed) throw new BookingCommerceError(`This booking window violates provider availability policy (${policy.reason}).`, 409, String(policy.reason))

  const bufferedStart = new Date(input.startsAt.getTime() - item.bufferBeforeMinutes * 60_000)
  const bufferedEnd = new Date(input.endsAt.getTime() + item.bufferAfterMinutes * 60_000)
  const components = await componentsFor(input.tx, item.id, selectedAddOns)
  const packageComponents = components.filter((entry) => entry.componentKind === 'package')
  if (item.bookingArchetype === 'package' && packageComponents.length === 0) {
    throw new BookingCommerceError('This package is not yet bound to deterministic component resources.', 409, 'PACKAGE_COMPONENTS_NOT_CONFIGURED')
  }

  const direct = await resourceCandidates(input.tx, item, input.variantId, bufferedStart, bufferedEnd, input.bookingId)
  if (direct.length) {
    const remaining = await allocateDirect(input.tx, input, item, input.variantId, input.quantity, bufferedStart, bufferedEnd)
    if (remaining > 0) throw new BookingCommerceError('The requested quantity is no longer available for those dates.', 409, 'CAPACITY_EXCEEDED')
  } else if (input.state === 'hold' && components.length === 0) {
    throw new BookingCommerceError('No deterministic inventory is configured for Instant Book.', 409, 'NO_BOOKABLE_RESOURCE')
  }

  for (const component of components) {
    const metadata = object(component.metadata)
    const perItem = metadata.quantityMode === 'per_item' || component.componentKind === 'package'
    await allocateInternal({
      ...input,
      catalogItemId: component.childCatalogItemId,
      variantId: component.childVariantId,
      quantity: component.quantity * (perItem ? input.quantity : 1),
      selectedOptions: {},
    }, nextVisited, depth + 1)
  }
  return direct.length > 0 || components.length > 0
}

export async function allocateBookingLineDeterministic(input: AllocationInput) {
  return allocateInternal(input, new Set<string>(), 0)
}
