import { db } from '../src/lib/db'
import { checkDeterministicAvailability } from '../src/lib/booking-resource-engine'

const startsAt = new Date(Date.now() + 20 * 86_400_000)
const endsAt = new Date(startsAt.getTime() + 6 * 60 * 60_000)

async function seed() {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."ProviderCatalogItem"
        (id,"offeringId",slug,name,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"holdMinutes","serviceAreaPolicy")
      VALUES
        ('uat-gown','uat-offering','uat-gown','Synthetic gown','individual_rental','instant','published',25000,'USD',15,'{"mode":"text_allowlist","required":true,"allowedTerms":["Harare"]}'::jsonb),
        ('uat-chairs','uat-offering','uat-chairs','Synthetic chairs','quantity_rental','instant','published',800,'USD',15,'{}'::jsonb),
        ('uat-package','uat-offering','uat-package','Synthetic ceremony package','package','instant','published',90000,'USD',15,'{}'::jsonb),
        ('uat-addon-parent','uat-offering','uat-addon-parent','Synthetic event service','event_day_service','instant','published',50000,'USD',15,'{}'::jsonb),
        ('uat-delivery-resource','uat-offering','uat-delivery','Synthetic delivery resource','transport','instant','published',10000,'USD',15,'{}'::jsonb)
    `)
    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."BookingResource" (id,"catalogItemId",name,"resourceType",capacity,status)
      VALUES
        ('uat-gown-r1','uat-gown','Gown serial','item',1,'active'),
        ('uat-chair-pool','uat-chairs','Chair pool','pool',10,'active'),
        ('uat-parent-capacity','uat-addon-parent','Event capacity','capacity',5,'active'),
        ('uat-delivery-vehicle','uat-delivery-resource','Delivery vehicle','vehicle',1,'active')
    `)
    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."ProviderCatalogComponent"
        (id,"parentCatalogItemId","childCatalogItemId","componentKind","selectionKey",name,quantity,"isOptional",status,metadata)
      VALUES
        ('uat-package-chairs','uat-package','uat-chairs','package',NULL,'Five chairs',5,false,'active','{}'::jsonb),
        ('uat-addon-delivery','uat-addon-parent','uat-delivery-resource','addon','delivery','Delivery vehicle',1,true,'active','{}'::jsonb)
    `)
    await tx.$executeRawUnsafe(`
      INSERT INTO wewed_booking."AvailabilityRule"
        (id,"resourceId","ruleType","startsAt","endsAt",reason)
      VALUES ('uat-delivery-blackout','uat-delivery-vehicle','blackout',$1,$2,'Synthetic vehicle blackout')
    `, startsAt, endsAt)
  })
}

async function expect(itemId: string, quantity: number, expected: boolean, label: string, extra: { serviceLocation?: string | null; selectedAddOns?: string[] } = {}) {
  const result = await checkDeterministicAvailability({ itemId, quantity, startsAt, endsAt, serviceLocation: extra.serviceLocation, selectedAddOns: extra.selectedAddOns || [] })
  if (result.available !== expected) throw new Error(`${label}: expected available=${expected}, got ${String(result.available)} (${String(result.reason)})`)
  return result
}

async function main() {
  await seed()

  await expect('uat-gown', 1, true, 'Serialized gown exact inventory', { serviceLocation: 'Harare CBD' })
  await expect('uat-gown', 2, false, 'Serialized gown cannot duplicate one serial item', { serviceLocation: 'Harare CBD' })
  const outsideArea = await expect('uat-gown', 1, false, 'Gown service area fail-closed', { serviceLocation: 'Bulawayo' })
  if (outsideArea.reason !== 'OUTSIDE_SERVICE_AREA') throw new Error('Service-area UAT must fail specifically as OUTSIDE_SERVICE_AREA.')

  await expect('uat-chairs', 10, true, 'Chair pool exact capacity')
  await expect('uat-chairs', 11, false, 'Chair pool over-capacity')

  await expect('uat-package', 2, true, 'Package child resource capacity')
  await expect('uat-package', 3, false, 'Package cannot exceed child resource capacity')

  await expect('uat-addon-parent', 1, true, 'Parent service without optional resource add-on')
  const withDelivery = await expect('uat-addon-parent', 1, false, 'Selected delivery add-on consumes blocked child resource', { selectedAddOns: ['delivery'] })
  if (!withDelivery.reason || withDelivery.reason === 'AVAILABLE') throw new Error('Resource add-on UAT must preserve a deterministic failure reason from the blocked child resource.')

  console.log('Synthetic booking gown/chair/package/add-on UAT: PASS')
}

main().finally(async () => { await db.$disconnect() })
