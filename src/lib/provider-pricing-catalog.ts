import type { PriceComponentType } from '@/lib/provider-commercial'

export type ProviderPricingPrompt = {
  key: string
  label: string
  type: PriceComponentType
  unit?: string
  help: string
  priority: 'core' | 'conditional'
}

const prompt = (
  key: string,
  label: string,
  type: PriceComponentType,
  help: string,
  unit?: string,
  priority: 'core' | 'conditional' = 'core',
): ProviderPricingPrompt => ({ key, label, type, help, unit, priority })

export const PROVIDER_PRICING_PROMPTS: Record<string, readonly ProviderPricingPrompt[]> = {
  venue: [
    prompt('venue-hire', 'Venue hire', 'fixed', 'Base hire charge for the ceremony/reception period.', 'event'),
    prompt('ceremony-fee', 'Separate ceremony fee', 'fixed_surcharge', 'Use when the ceremony space is charged separately.', 'event', 'conditional'),
    prompt('guest-overage', 'Guest/capacity overage', 'per_guest', 'Additional price when a package includes only a set guest count.', 'guest', 'conditional'),
    prompt('overtime', 'Venue overtime', 'per_hour', 'Charge when the event continues beyond the included hire window.', 'hour', 'conditional'),
    prompt('corkage', 'Corkage', 'per_item', 'Charge for externally supplied bottles or beverage units.', 'bottle', 'conditional'),
    prompt('security-cleaning', 'Security or cleaning fee', 'fixed_surcharge', 'Mandatory venue operations fee if not already included.', 'event', 'conditional'),
    prompt('accommodation', 'On-site accommodation', 'per_room', 'Room or suite rate when accommodation is sold with the wedding.', 'room/night', 'conditional'),
  ],
  planning: [
    prompt('planning-package', 'Planning package', 'fixed', 'Full, partial, month-of or wedding-day planning fee.', 'package'),
    prompt('budget-percentage', 'Percentage-of-budget planning fee', 'percentage_of_budget', 'Use only when your fee is calculated from the managed wedding budget.', 'percent', 'conditional'),
    prompt('consultation', 'Consultation', 'per_hour', 'Hourly planning or advisory consultation.', 'hour', 'conditional'),
    prompt('assistant', 'Additional planner/assistant', 'per_day', 'Additional team member required for larger or more complex weddings.', 'person/day', 'conditional'),
    prompt('planner-travel', 'Planner travel', 'per_kilometre', 'Travel outside the included service radius.', 'km', 'conditional'),
  ],
  photography: [
    prompt('photo-coverage', 'Photography coverage', 'per_hour', 'Coverage beyond or instead of a fixed package.', 'hour'),
    prompt('second-shooter', 'Second photographer', 'fixed_surcharge', 'Additional shooter not included in the base package.', 'event', 'conditional'),
    prompt('photo-overtime', 'Photography overtime', 'per_hour', 'Coverage beyond the package hours.', 'hour', 'conditional'),
    prompt('album', 'Album', 'per_item', 'Album or photobook price.', 'album', 'conditional'),
    prompt('engagement-session', 'Engagement session', 'fixed_surcharge', 'Pre-wedding engagement or couple session.', 'session', 'conditional'),
    prompt('photo-travel', 'Photography travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  videography: [
    prompt('video-coverage', 'Videography coverage', 'per_hour', 'Wedding-film coverage beyond or instead of a fixed package.', 'hour'),
    prompt('video-operator', 'Additional camera operator', 'per_day', 'Extra operator required for multi-location or larger weddings.', 'person/day', 'conditional'),
    prompt('livestream', 'Livestreaming', 'fixed_surcharge', 'Livestream setup and delivery.', 'event', 'conditional'),
    prompt('drone', 'Drone coverage', 'fixed_surcharge', 'Drone filming where permitted.', 'event', 'conditional'),
    prompt('video-overtime', 'Videography overtime', 'per_hour', 'Coverage beyond included hours.', 'hour', 'conditional'),
    prompt('video-travel', 'Videography travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  florals: [
    prompt('bridal-bouquet', 'Bridal bouquet', 'per_item', 'Price per bridal bouquet.', 'bouquet'),
    prompt('buttonhole', 'Buttonhole/boutonniere', 'per_item', 'Price per buttonhole.', 'item', 'conditional'),
    prompt('table-centrepiece', 'Table centrepiece', 'per_table', 'Price per guest table centrepiece.', 'table'),
    prompt('ceremony-installation', 'Ceremony arch/installation', 'fixed_surcharge', 'Fixed design/build price for the ceremony installation.', 'installation', 'conditional'),
    prompt('floral-setup', 'Floral setup/teardown', 'fixed_surcharge', 'Labour for setup and teardown when charged separately.', 'event', 'conditional'),
    prompt('import-premium', 'Seasonal/import flower premium', 'percentage_surcharge', 'Percentage uplift for imported or out-of-season flowers.', 'percent', 'conditional'),
  ],
  catering: [
    prompt('adult-meal', 'Adult guest meal', 'per_adult', 'Per-adult menu price.', 'adult'),
    prompt('child-meal', 'Child guest meal', 'per_child', 'Per-child menu price.', 'child', 'conditional'),
    prompt('service-staff', 'Additional service staff', 'per_hour', 'Staffing not included in the base menu/package.', 'staff/hour', 'conditional'),
    prompt('equipment', 'Catering equipment/crockery', 'per_guest', 'Per-guest equipment charge when not included.', 'guest', 'conditional'),
    prompt('dietary-premium', 'Special dietary menu premium', 'per_guest', 'Extra cost for specialised dietary menus where applicable.', 'guest', 'conditional'),
    prompt('catering-travel', 'Catering travel/delivery', 'per_kilometre', 'Delivery or travel outside the included radius.', 'km', 'conditional'),
  ],
  cakes: [
    prompt('cake-serving', 'Cake price per serving', 'per_serving', 'Price used when cake size is calculated by servings.', 'serving'),
    prompt('cake-tier', 'Additional tier/design component', 'per_item', 'Use for per-tier or major design increments.', 'tier', 'conditional'),
    prompt('cake-complexity', 'Custom design premium', 'fixed_surcharge', 'Sugar flowers, sculpting, metallic work or other complex design labour.', 'cake', 'conditional'),
    prompt('cake-delivery', 'Cake delivery', 'fixed_surcharge', 'Delivery charge when not included.', 'delivery', 'conditional'),
    prompt('cake-setup', 'Cake/dessert-table setup', 'fixed_surcharge', 'Venue setup or dessert-table styling.', 'event', 'conditional'),
  ],
  entertainment: [
    prompt('performance', 'Performance/DJ package', 'fixed', 'Base performance package.', 'event'),
    prompt('performance-hour', 'Additional performance hour', 'per_hour', 'Extra performance time beyond the package.', 'hour', 'conditional'),
    prompt('additional-performer', 'Additional performer', 'per_item', 'Additional musician, vocalist, dancer or performer.', 'performer', 'conditional'),
    prompt('equipment-entertainment', 'Sound/equipment supplement', 'fixed_surcharge', 'Equipment not included in the base performance fee.', 'event', 'conditional'),
    prompt('entertainment-travel', 'Entertainment travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  'decor-rentals': [
    prompt('chair-rental', 'Chair rental', 'per_item', 'Price per chair.', 'chair'),
    prompt('table-rental', 'Table rental', 'per_item', 'Price per table.', 'table'),
    prompt('linen-rental', 'Linen rental', 'per_item', 'Price per linen/tablecloth/runner unit.', 'item', 'conditional'),
    prompt('decor-installation', 'Décor installation', 'fixed_surcharge', 'Design/setup labour.', 'event', 'conditional'),
    prompt('decor-delivery', 'Delivery/collection', 'fixed_surcharge', 'Transport, delivery and collection charge.', 'event', 'conditional'),
    prompt('damage-deposit', 'Refundable damage deposit', 'refundable_security', 'Refundable security amount for hired inventory.', 'booking', 'conditional'),
  ],
  beauty: [
    prompt('bride-beauty', 'Bride hair/makeup service', 'per_item', 'Price for the bride service.', 'person/service'),
    prompt('party-beauty', 'Wedding-party hair/makeup', 'per_item', 'Price per additional person/service.', 'person/service', 'conditional'),
    prompt('beauty-trial', 'Hair/makeup trial', 'per_session', 'Pre-wedding trial session.', 'session', 'conditional'),
    prompt('early-start', 'Early-start surcharge', 'fixed_surcharge', 'Fee for very early call times.', 'booking', 'conditional'),
    prompt('beauty-travel', 'Beauty travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  attire: [
    prompt('attire-garment', 'Garment purchase/hire', 'per_item', 'Base price per dress, suit or formalwear item.', 'garment'),
    prompt('tailoring', 'Tailoring/alterations', 'per_item', 'Fitting and alteration charge per garment.', 'garment', 'conditional'),
    prompt('customisation', 'Customisation', 'fixed_surcharge', 'Custom design, embroidery or bespoke construction uplift.', 'garment', 'conditional'),
    prompt('attire-accessory', 'Accessories', 'per_item', 'Veil, shoes, tie, jewellery or other accessory.', 'item', 'conditional'),
  ],
  transport: [
    prompt('vehicle-hire', 'Vehicle hire', 'per_vehicle', 'Base vehicle charge.', 'vehicle'),
    prompt('transport-trip', 'Additional trip', 'per_trip', 'Extra journey beyond the package.', 'trip', 'conditional'),
    prompt('transport-hour', 'Waiting/additional hire time', 'per_hour', 'Waiting time or extra hire duration.', 'hour', 'conditional'),
    prompt('transport-distance', 'Distance charge', 'per_kilometre', 'Mileage outside the included distance.', 'km', 'conditional'),
    prompt('driver-fuel', 'Driver/fuel supplement', 'fixed_surcharge', 'Mandatory driver or fuel fee when not included.', 'vehicle', 'conditional'),
  ],
  stationery: [
    prompt('stationery-design', 'Design/setup fee', 'fixed', 'Initial artwork or design setup.', 'design'),
    prompt('stationery-unit', 'Printed item', 'per_item', 'Invitation, menu, programme, place card or sign unit price.', 'item'),
    prompt('stationery-personalisation', 'Personalisation', 'per_item', 'Name/custom data printing per item.', 'item', 'conditional'),
    prompt('stationery-delivery', 'Delivery', 'fixed_surcharge', 'Delivery/courier when not included.', 'order', 'conditional'),
  ],
  officiants: [
    prompt('ceremony-officiant', 'Ceremony officiation', 'fixed', 'Base ceremony fee.', 'ceremony'),
    prompt('rehearsal-officiant', 'Rehearsal attendance', 'fixed_surcharge', 'Additional rehearsal attendance.', 'session', 'conditional'),
    prompt('documentation-officiant', 'Documentation/admin', 'fixed_surcharge', 'Paperwork or administrative fee where applicable.', 'booking', 'conditional'),
    prompt('officiant-travel', 'Officiant travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  jewellery: [
    prompt('jewellery-item', 'Jewellery item', 'per_item', 'Ring, necklace, earring or accessory price.', 'item'),
    prompt('material-premium', 'Material/stone upgrade', 'fixed_surcharge', 'Upgrade from base metal, stone or specification.', 'item', 'conditional'),
    prompt('engraving', 'Engraving/customisation', 'per_item', 'Custom engraving or personalisation.', 'item', 'conditional'),
    prompt('resizing', 'Sizing/alteration', 'per_item', 'Ring resizing or fit adjustment.', 'item', 'conditional'),
  ],
  'accommodation-travel': [
    prompt('room-night', 'Room/night', 'per_room', 'Accommodation price per room per night.', 'room/night'),
    prompt('additional-night', 'Additional night', 'per_night', 'Extra stay outside the base package.', 'night', 'conditional'),
    prompt('meal-plan', 'Meal-plan supplement', 'per_guest', 'Breakfast or other meal-plan supplement.', 'guest/night', 'conditional'),
    prompt('transfer', 'Guest transfer', 'per_trip', 'Airport/venue/station transfer.', 'trip', 'conditional'),
  ],
  'tents-marquees': [
    prompt('marquee-hire', 'Tent/marquee hire', 'fixed', 'Base structure hire by size/capacity.', 'structure'),
    prompt('flooring', 'Flooring', 'per_item', 'Flooring charge using your chosen square-metre or panel unit.', 'unit', 'conditional'),
    prompt('sidewall', 'Walls/weather additions', 'per_item', 'Sidewalls, lining or weather protection.', 'unit', 'conditional'),
    prompt('marquee-setup', 'Setup/strike', 'fixed_surcharge', 'Installation and removal labour.', 'event', 'conditional'),
    prompt('marquee-delivery', 'Delivery', 'per_kilometre', 'Transport outside the included radius.', 'km', 'conditional'),
  ],
  'lighting-av': [
    prompt('av-package', 'AV/lighting package', 'fixed', 'Base equipment package.', 'event'),
    prompt('av-operator', 'Technician/operator', 'per_hour', 'Operator hours not included in package.', 'person/hour', 'conditional'),
    prompt('av-extra-equipment', 'Additional equipment', 'per_item', 'Extra light, speaker, microphone, screen or stage component.', 'item', 'conditional'),
    prompt('av-overtime', 'AV overtime', 'per_hour', 'Extended production time.', 'hour', 'conditional'),
    prompt('av-setup', 'Setup/strike', 'fixed_surcharge', 'Installation and removal labour.', 'event', 'conditional'),
  ],
  'bar-beverages': [
    prompt('beverage-guest', 'Beverage package per guest', 'per_guest', 'Per-guest beverage package.', 'guest'),
    prompt('beverage-item', 'Bottle/unit beverage', 'per_item', 'Price per bottle, case or beverage unit.', 'unit', 'conditional'),
    prompt('bar-staff', 'Bar staff', 'per_hour', 'Bartender/server staffing.', 'staff/hour', 'conditional'),
    prompt('bar-setup', 'Mobile bar/setup', 'fixed_surcharge', 'Bar equipment and setup charge.', 'event', 'conditional'),
    prompt('bar-overtime', 'Bar overtime', 'per_hour', 'Additional service time.', 'hour', 'conditional'),
  ],
  'photo-booth': [
    prompt('booth-package', 'Photo booth package', 'fixed', 'Base booth hire package.', 'event'),
    prompt('booth-overtime', 'Additional booth hour', 'per_hour', 'Extra booth operation time.', 'hour', 'conditional'),
    prompt('booth-print', 'Additional prints', 'per_item', 'Print quantity beyond the package allowance.', 'print', 'conditional'),
    prompt('booth-attendant', 'Additional attendant', 'per_hour', 'Attendant where not included.', 'person/hour', 'conditional'),
  ],
  'content-creation': [
    prompt('content-coverage', 'Content coverage', 'per_hour', 'On-site wedding content creation time.', 'hour'),
    prompt('content-deliverable', 'Additional deliverable', 'per_item', 'Extra edited reel, clip, gallery or content set.', 'deliverable', 'conditional'),
    prompt('content-overtime', 'Additional coverage hour', 'per_hour', 'Coverage beyond the booked period.', 'hour', 'conditional'),
    prompt('content-travel', 'Content creator travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  'gifts-favours': [
    prompt('favour-unit', 'Gift/favour unit', 'per_item', 'Price per guest gift or favour.', 'item'),
    prompt('personalisation-favour', 'Personalisation', 'per_item', 'Names, dates, packaging or custom artwork.', 'item', 'conditional'),
    prompt('favour-setup', 'Design/setup', 'fixed_surcharge', 'One-time design or production setup.', 'order', 'conditional'),
    prompt('favour-delivery', 'Delivery', 'fixed_surcharge', 'Delivery/courier charge.', 'order', 'conditional'),
  ],
  choreography: [
    prompt('dance-session', 'Dance/choreography lesson', 'per_session', 'Price per lesson/session.', 'session'),
    prompt('dance-package', 'Lesson package', 'fixed', 'Multi-session choreography package.', 'package', 'conditional'),
    prompt('choreography-travel', 'Choreographer travel', 'per_kilometre', 'Travel outside the included radius.', 'km', 'conditional'),
  ],
  security: [
    prompt('guard-hour', 'Security guard', 'per_hour', 'Price per guard per hour.', 'guard/hour'),
    prompt('supervisor', 'Security supervisor', 'per_hour', 'Supervisor charge for larger teams/events.', 'person/hour', 'conditional'),
    prompt('security-minimum', 'Minimum deployment fee', 'fixed_surcharge', 'Minimum call-out/deployment charge.', 'event', 'conditional'),
    prompt('security-equipment', 'Security equipment', 'fixed_surcharge', 'Radios, barriers or access equipment when charged separately.', 'event', 'conditional'),
  ],
  childcare: [
    prompt('childcare-child', 'Childcare per child', 'per_child', 'Per-child charge for the booked period.', 'child'),
    prompt('childcare-carer', 'Additional carer', 'per_hour', 'Additional caregiver required by age mix or child count.', 'carer/hour', 'conditional'),
    prompt('childcare-hour', 'Additional childcare hour', 'per_hour', 'Service beyond included hours.', 'hour', 'conditional'),
    prompt('childcare-activity', 'Activity/materials', 'per_child', 'Crafts, games, meals or activity materials.', 'child', 'conditional'),
  ],
  'cleaning-sanitation': [
    prompt('cleaning-labour', 'Cleaning labour', 'per_hour', 'Cleaning staff hours.', 'person/hour'),
    prompt('washroom-hire', 'Portable washroom/toilet hire', 'per_item', 'Price per sanitation unit.', 'unit', 'conditional'),
    prompt('sanitation-service', 'Servicing/consumables', 'per_item', 'Consumables or servicing per unit/event.', 'unit', 'conditional'),
    prompt('cleaning-callout', 'Call-out/setup', 'fixed_surcharge', 'Transport/setup charge.', 'event', 'conditional'),
  ],
  other: [
    prompt('other-base', 'Base service/package', 'fixed', 'Core service price.', 'service'),
    prompt('other-unit', 'Quantity-based component', 'per_item', 'Price per relevant item, person or unit.', 'unit', 'conditional'),
    prompt('other-time', 'Time-based component', 'per_hour', 'Price per hour where time affects cost.', 'hour', 'conditional'),
    prompt('other-travel', 'Travel/delivery', 'per_kilometre', 'Travel or delivery outside the included radius.', 'km', 'conditional'),
  ],
}

export function providerPricingPrompts(category: string): readonly ProviderPricingPrompt[] {
  return PROVIDER_PRICING_PROMPTS[category] ?? PROVIDER_PRICING_PROMPTS.other
}
