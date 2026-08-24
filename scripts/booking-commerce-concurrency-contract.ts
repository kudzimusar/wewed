import { db } from '../src/lib/db'
import { BookingCommerceError } from '../src/lib/booking-commerce'
import { allocateBookingLineDeterministic, checkDeterministicAvailability } from '../src/lib/booking-resource-engine'

const startsAt = new Date(Date.now() + 10 * 86_400_000)
const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60_000)

async function seed() {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')

    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."ProviderCatalogItem"
        (id,"offeringId",slug,name,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"holdMinutes","requiresContract")
      VALUES
        ('ci-gown-item','ci-offering','ci-gown','CI serialized gown','individual_rental','instant','published',30000,'USD',15,false),
        ('ci-chair-item','ci-offering','ci-chairs','CI chair pool','quantity_rental','instant','published',1000,'USD',15,false),
        ('ci-package-item','ci-offering','ci-package','CI ceremony package','package','instant','published',120000,'USD',15,false)
    `)

    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."BookingResource"
        (id,"catalogItemId",name,"resourceType",capacity,status)
      VALUES
        ('ci-gown-resource','ci-gown-item','CI gown serial 1','item',1,'active'),
        ('ci-chair-resource','ci-chair-item','CI chair pool','pool',10,'active')
    `)

    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."ProviderCatalogComponent"
        (id,"parentCatalogItemId","childCatalogItemId","componentKind",name,quantity,"isOptional",status,metadata)
      VALUES
        ('ci-package-chair-component','ci-package-item','ci-chair-item','package','Five chairs per package',5,false,'active','{}'::jsonb)
    `)

    for (const [bookingId, lineId, itemId, quantity] of [
      ['ci-gown-booking-a','ci-gown-line-a','ci-gown-item',1],
      ['ci-gown-booking-b','ci-gown-line-b','ci-gown-item',1],
      ['ci-chair-booking-a','ci-chair-line-a','ci-chair-item',6],
      ['ci-chair-booking-b','ci-chair-line-b','ci-chair-item',6],
    ] as const) {
      await tx.$executeRawUnsafe(`
        INSERT INTO wewed_booking."Booking"
          (id,"publicReference","businessAccountId","offeringId","weddingId","customerUserId","createdByUserId","bookingMode",status,currency,"serviceStart","serviceEnd","serviceLocation")
        VALUES ($1,$2,'ci-business','ci-offering','ci-wedding','ci-user','ci-user','instant','draft','USD',$3,$4,'Harare')
      `, bookingId, `WW-CI-${bookingId}`, startsAt, endsAt)
      await tx.$executeRawUnsafe(`
        INSERT INTO wewed_booking."BookingLine"
          (id,"bookingId","catalogItemId","nameSnapshot",quantity,"selectedOptions")
        VALUES ($1,$2,$3,$4,$5,'{"addOns":[]}'::jsonb)
      `, lineId, bookingId, itemId, itemId, quantity)
    }
  })
}

async function allocate(bookingId: string, lineId: string, itemId: string, quantity: number) {
  return db.$transaction(async (tx) => allocateBookingLineDeterministic({
    tx,
    bookingId,
    bookingLineId: lineId,
    catalogItemId: itemId,
    variantId: null,
    quantity,
    selectedOptions: { addOns: [] },
    startsAt,
    endsAt,
    state: 'confirmed',
    holdId: null,
    expiresAt: null,
    serviceLocation: 'Harare',
  }))
}

function assertOneWinner(results: PromiseSettledResult<unknown>[], label: string) {
  const fulfilled = results.filter((entry) => entry.status === 'fulfilled')
  const rejected = results.filter((entry) => entry.status === 'rejected') as PromiseRejectedResult[]
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error(`${label}: expected exactly one successful competing allocation, got ${fulfilled.length} success / ${rejected.length} rejection`)
  }
  const reason = rejected[0].reason
  if (!(reason instanceof BookingCommerceError) || reason.code !== 'CAPACITY_EXCEEDED') {
    throw new Error(`${label}: losing allocation must fail with CAPACITY_EXCEEDED`)
  }
}

async function allocationTotal(resourceId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ quantity: bigint }>>(`
    SELECT COALESCE(SUM(quantity),0)::bigint AS quantity
      FROM wewed_booking."BookingResourceAllocation"
     WHERE "resourceId"=$1 AND state='confirmed'
  `, resourceId)
  return Number(rows[0]?.quantity ?? 0)
}

async function main() {
  await seed()

  const packageTwo = await checkDeterministicAvailability({
    itemId: 'ci-package-item', quantity: 2, startsAt, endsAt, serviceLocation: 'Harare', selectedAddOns: [],
  })
  if (packageTwo.available !== true) throw new Error('Package contract: two packages should be available from ten child chairs at five chairs each.')

  const packageThree = await checkDeterministicAvailability({
    itemId: 'ci-package-item', quantity: 3, startsAt, endsAt, serviceLocation: 'Harare', selectedAddOns: [],
  })
  if (packageThree.available !== false) throw new Error('Package contract: three packages must be unavailable when only ten child chairs exist.')

  const gownResults = await Promise.allSettled([
    allocate('ci-gown-booking-a','ci-gown-line-a','ci-gown-item',1),
    allocate('ci-gown-booking-b','ci-gown-line-b','ci-gown-item',1),
  ])
  assertOneWinner(gownResults, 'Serialized gown concurrency')
  if (await allocationTotal('ci-gown-resource') !== 1) throw new Error('Serialized gown concurrency: confirmed allocation exceeded serial capacity 1.')

  const chairResults = await Promise.allSettled([
    allocate('ci-chair-booking-a','ci-chair-line-a','ci-chair-item',6),
    allocate('ci-chair-booking-b','ci-chair-line-b','ci-chair-item',6),
  ])
  assertOneWinner(chairResults, 'Chair pool concurrency')
  const chairsAllocated = await allocationTotal('ci-chair-resource')
  if (chairsAllocated > 10 || chairsAllocated !== 6) throw new Error(`Chair pool concurrency: expected one six-chair allocation within capacity 10, got ${chairsAllocated}.`)

  console.log('Booking commerce concurrency/package contract: PASS')
}

main().finally(async () => { await db.$disconnect() })
