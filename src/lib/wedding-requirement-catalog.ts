import { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'

export const WEDDING_REQUIREMENT_PRIORITIES = [
  'required',
  'strong_preference',
  'preferred',
  'flexible',
  'not_required',
] as const

export const WEDDING_PLAN_STRATEGIES = ['value', 'balanced', 'priority_led'] as const

export type WeddingRequirementPriority = (typeof WEDDING_REQUIREMENT_PRIORITIES)[number]
export type WeddingPlanStrategy = (typeof WEDDING_PLAN_STRATEGIES)[number]
export type WeddingRequirementFieldType = 'number' | 'select' | 'multiselect' | 'boolean' | 'text'

export type WeddingRequirementField = {
  key: string
  label: string
  type: WeddingRequirementFieldType
  help: string
  options?: readonly string[]
  unit?: string
  min?: number
  max?: number
}

const field = (
  key: string,
  label: string,
  type: WeddingRequirementFieldType,
  help: string,
  options?: readonly string[],
  unit?: string,
  min?: number,
  max?: number,
): WeddingRequirementField => ({ key, label, type, help, options, unit, min, max })

export const WEDDING_REQUIREMENT_FIELDS: Record<string, readonly WeddingRequirementField[]> = {
  venue: [
    field('seatedGuests', 'Required seated capacity', 'number', 'The venue must safely seat at least this many people.', undefined, 'guests', 1, 20000),
    field('ceremonyAndReceptionTogether', 'Ceremony and reception at one venue', 'boolean', 'Whether both parts of the day must be hosted at the same property.'),
    field('setting', 'Preferred setting', 'select', 'The preferred ceremony/reception environment.', ['Indoor', 'Outdoor', 'Indoor + outdoor', 'No preference']),
    field('accommodationRequired', 'On-site accommodation required', 'boolean', 'Whether the selected venue must provide guest or wedding-party accommodation.'),
    field('externalCateringRequired', 'External catering must be allowed', 'boolean', 'Use when the couple already has or requires an external caterer.'),
    field('accessibilityRequired', 'Accessible venue required', 'boolean', 'Whether step-free access and accessible facilities are a hard requirement.'),
  ],
  planning: [
    field('planningType', 'Planning support needed', 'select', 'The level of professional planning support required.', ['Full planning', 'Partial planning', 'Month-of coordination', 'Wedding-day coordination', 'Consultation only']),
    field('plannerBudgetStyle', 'Planner fee preference', 'select', 'How the couple is comfortable paying the planner.', ['Fixed package', 'Percentage of budget', 'Hourly / consultation', 'No preference']),
    field('destinationSupport', 'Destination/travel planning required', 'boolean', 'Whether the planner must coordinate travel or destination logistics.'),
  ],
  photography: [
    field('coverageHours', 'Photography coverage', 'number', 'How many hours of photography are required.', undefined, 'hours', 1, 48),
    field('secondShooter', 'Second photographer required', 'boolean', 'Whether two simultaneous photographers are required.'),
    field('albumRequired', 'Printed album required', 'boolean', 'Whether the plan must include an album rather than treat it as an optional add-on.'),
    field('engagementSession', 'Engagement session required', 'boolean', 'Whether a pre-wedding couple session must be included.'),
    field('style', 'Photography style', 'multiselect', 'Preferred visual approach.', ['Documentary', 'Editorial', 'Fine art', 'Traditional', 'Candid', 'Film-inspired', 'Flash photography']),
  ],
  videography: [
    field('coverageHours', 'Video coverage', 'number', 'How many hours of videography are required.', undefined, 'hours', 1, 48),
    field('livestreamRequired', 'Livestream required', 'boolean', 'Whether remote guests must be able to watch live.'),
    field('dronePreferred', 'Drone coverage preferred', 'boolean', 'Whether aerial coverage should be considered where permitted.'),
    field('fullCeremonyFilm', 'Full ceremony film required', 'boolean', 'Whether a full-length ceremony edit is required.'),
    field('socialEdit', 'Rapid social edit required', 'boolean', 'Whether a fast vertical/social deliverable is required.'),
  ],
  florals: [
    field('bridalBouquets', 'Bridal bouquets', 'number', 'Number of bridal bouquets required.', undefined, 'bouquets', 0, 50),
    field('buttonholes', 'Buttonholes/boutonnieres', 'number', 'Number of buttonholes required.', undefined, 'items', 0, 200),
    field('guestTables', 'Guest table centrepieces', 'number', 'Number of guest tables needing floral centrepieces.', undefined, 'tables', 0, 500),
    field('ceremonyInstallation', 'Ceremony arch/installation required', 'boolean', 'Whether a floral ceremony installation must be priced.'),
    field('flowerPreference', 'Flower preference', 'select', 'Whether fresh/imported/artificial options are acceptable.', ['Fresh preferred', 'Fresh only', 'Artificial acceptable', 'Mixed', 'No preference']),
  ],
  catering: [
    field('adultGuests', 'Adults to cater for', 'number', 'Adult meal quantity used in deterministic catering calculations.', undefined, 'adults', 0, 20000),
    field('childGuests', 'Children to cater for', 'number', 'Child meal quantity used in deterministic catering calculations.', undefined, 'children', 0, 5000),
    field('serviceStyle', 'Meal service style', 'select', 'Preferred catering service style.', ['Buffet', 'Plated', 'Family-style', 'Canapés', 'Food stations', 'Braai', 'No preference']),
    field('cuisines', 'Cuisine preferences', 'multiselect', 'Cuisine families that fit the wedding.', ['Zimbabwean', 'Southern African', 'Pan-African', 'European', 'Indian', 'Middle Eastern', 'Asian', 'Fusion', 'Other']),
    field('dietarySupport', 'Dietary requirements', 'multiselect', 'Dietary capabilities the caterer must support.', ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-aware', 'Halal', 'Kosher by arrangement', 'Allergy-managed menus']),
    field('equipmentRequired', 'Crockery/staff/equipment required', 'boolean', 'Whether the catering price must include service equipment and staffing.'),
  ],
  cakes: [
    field('servings', 'Cake servings required', 'number', 'Required number of portions.', undefined, 'servings', 1, 20000),
    field('tiers', 'Preferred tiers', 'number', 'Preferred tier count when materially important.', undefined, 'tiers', 1, 20),
    field('dessertTable', 'Dessert table required', 'boolean', 'Whether the supplier must include additional desserts/favours.'),
    field('dietaryOptions', 'Cake dietary requirements', 'multiselect', 'Dietary options that must be supported.', ['Vegan', 'Gluten-free', 'Dairy-free', 'Egg-free', 'Nut-aware', 'Sugar-reduced', 'Alcohol-free']),
  ],
  entertainment: [
    field('entertainmentType', 'Entertainment type', 'multiselect', 'Types of entertainment to consider.', ['DJ', 'Live band', 'MC', 'Solo musician', 'Choir', 'Traditional performers', 'Dancers', 'Other']),
    field('performanceHours', 'Performance/service duration', 'number', 'Required entertainment duration.', undefined, 'hours', 1, 24),
    field('soundIncluded', 'Sound equipment must be included', 'boolean', 'Whether the entertainment provider must supply the required sound system.'),
  ],
  'decor-rentals': [
    field('chairs', 'Chairs required', 'number', 'Chair quantity required from the rental provider.', undefined, 'chairs', 0, 20000),
    field('tables', 'Tables required', 'number', 'Table quantity required.', undefined, 'tables', 0, 2000),
    field('linenSets', 'Linen sets required', 'number', 'Linen/tablecloth/runner quantity.', undefined, 'sets', 0, 5000),
    field('installationRequired', 'Décor installation required', 'boolean', 'Whether provider setup/styling labour must be included.'),
    field('collectionRequired', 'Collection/teardown required', 'boolean', 'Whether post-event collection or teardown must be included.'),
  ],
  beauty: [
    field('brideServices', 'Bride services', 'multiselect', 'Beauty services required for the bride.', ['Hair', 'Makeup', 'Hair + makeup', 'Grooming']),
    field('partyCount', 'Additional people requiring services', 'number', 'Wedding-party members requiring beauty services.', undefined, 'people', 0, 100),
    field('trialRequired', 'Trial required', 'boolean', 'Whether a pre-wedding trial must be included.'),
    field('earlyStart', 'Early start expected', 'boolean', 'Whether service may begin at a time that triggers an early-start fee.'),
  ],
  attire: [
    field('garments', 'Garments required', 'number', 'Total garments the plan should account for.', undefined, 'garments', 1, 100),
    field('purchaseOrHire', 'Purchase or hire', 'select', 'Preferred commercial arrangement.', ['Purchase', 'Hire', 'Either']),
    field('customRequired', 'Custom/bespoke work required', 'boolean', 'Whether off-the-rack options are insufficient.'),
    field('alterationsRequired', 'Alterations/tailoring required', 'boolean', 'Whether alteration costs should be included.'),
  ],
  transport: [
    field('passengers', 'Passengers requiring transport', 'number', 'People Wewed should allocate transport capacity for.', undefined, 'people', 1, 5000),
    field('vehicleType', 'Preferred vehicle type', 'select', 'Preferred transport style.', ['Luxury car', 'Classic car', 'SUV', 'Minibus', 'Coach', 'Shuttle', 'No preference']),
    field('trips', 'Estimated trips', 'number', 'Number of journeys required.', undefined, 'trips', 1, 100),
    field('hireHours', 'Hire duration', 'number', 'Approximate required hire duration.', undefined, 'hours', 1, 48),
  ],
  stationery: [
    field('invitations', 'Printed invitations', 'number', 'Printed invitation quantity.', undefined, 'items', 0, 10000),
    field('menus', 'Menus/programmes', 'number', 'Menu or programme quantity.', undefined, 'items', 0, 20000),
    field('placeCards', 'Place cards', 'number', 'Personalised place-card quantity.', undefined, 'items', 0, 20000),
    field('signageRequired', 'Event signage required', 'boolean', 'Whether welcome/seating/directional signage must be included.'),
    field('personalisation', 'Personalisation required', 'boolean', 'Whether variable guest names or custom data must be printed.'),
  ],
  officiants: [
    field('ceremonyType', 'Ceremony type', 'select', 'Type of ceremony requiring officiation.', ['Civil', 'Religious', 'Cultural/traditional', 'Celebrant-led', 'Symbolic', 'Other']),
    field('rehearsalRequired', 'Rehearsal required', 'boolean', 'Whether the officiant must attend a rehearsal.'),
    field('documentationSupport', 'Documentation support required', 'boolean', 'Whether administrative/legal paperwork support is required.'),
  ],
  jewellery: [
    field('itemsRequired', 'Jewellery items required', 'number', 'Number of rings or jewellery pieces to budget for.', undefined, 'items', 1, 20),
    field('customisationRequired', 'Custom design/engraving required', 'boolean', 'Whether custom work must be included.'),
    field('materialPreference', 'Material preference', 'text', 'Preferred metal, stones or materials if already known.'),
  ],
  'accommodation-travel': [
    field('rooms', 'Rooms required', 'number', 'Number of rooms to budget.', undefined, 'rooms', 1, 5000),
    field('nights', 'Nights required', 'number', 'Number of nights to budget.', undefined, 'nights', 1, 30),
    field('guestsStaying', 'Guests staying', 'number', 'Expected accommodated guest count.', undefined, 'guests', 1, 10000),
    field('transfersRequired', 'Guest transfers required', 'boolean', 'Whether travel between airport/station/venue/accommodation must be included.'),
  ],
  'tents-marquees': [
    field('capacity', 'Covered capacity required', 'number', 'Number of guests the structure must accommodate.', undefined, 'guests', 1, 20000),
    field('flooringRequired', 'Flooring required', 'boolean', 'Whether flooring must be included.'),
    field('weatherWallsRequired', 'Weather walls/lining required', 'boolean', 'Whether sidewalls or weather protection must be included.'),
    field('setupRequired', 'Setup and strike required', 'boolean', 'Whether installation/removal must be part of the quote.'),
  ],
  'lighting-av': [
    field('serviceHours', 'Production hours', 'number', 'Required operational production duration.', undefined, 'hours', 1, 48),
    field('soundRequired', 'Sound system required', 'boolean', 'Whether PA/speaker equipment must be included.'),
    field('lightingRequired', 'Event lighting required', 'boolean', 'Whether decorative/stage lighting must be included.'),
    field('stageRequired', 'Stage required', 'boolean', 'Whether staging must be part of the service.'),
    field('microphones', 'Microphones required', 'number', 'Required microphone quantity.', undefined, 'mics', 0, 100),
  ],
  'bar-beverages': [
    field('drinkingGuests', 'Guests using beverage service', 'number', 'Guest count used for package pricing.', undefined, 'guests', 0, 20000),
    field('serviceHours', 'Bar service duration', 'number', 'Hours of beverage service.', undefined, 'hours', 1, 24),
    field('serviceType', 'Beverage service type', 'select', 'Preferred commercial model.', ['Hosted package', 'Cash bar', 'Mixed', 'Non-alcoholic only', 'No preference']),
    field('staffRequired', 'Bar staff required', 'boolean', 'Whether bartender/server staffing must be included.'),
  ],
  'photo-booth': [
    field('hours', 'Photo booth hours', 'number', 'Required booth operation duration.', undefined, 'hours', 1, 24),
    field('printsRequired', 'Printed keepsakes required', 'boolean', 'Whether physical prints must be included.'),
    field('attendantRequired', 'Booth attendant required', 'boolean', 'Whether staffing must be included.'),
  ],
  'content-creation': [
    field('coverageHours', 'Content coverage', 'number', 'Required on-site content-creation duration.', undefined, 'hours', 1, 48),
    field('rapidDelivery', 'Same/next-day delivery required', 'boolean', 'Whether rapid turnaround is a hard requirement.'),
    field('reels', 'Edited reels/clips required', 'number', 'Expected edited short-form deliverables.', undefined, 'deliverables', 0, 100),
  ],
  'gifts-favours': [
    field('quantity', 'Gift/favour quantity', 'number', 'Number of items required.', undefined, 'items', 1, 20000),
    field('personalisationRequired', 'Personalisation required', 'boolean', 'Whether names, date or custom artwork must be included.'),
    field('packagingRequired', 'Individual packaging required', 'boolean', 'Whether each item must be packaged/presented separately.'),
  ],
  choreography: [
    field('sessions', 'Lessons/sessions required', 'number', 'Number of choreography sessions expected.', undefined, 'sessions', 1, 100),
    field('participants', 'Participants', 'number', 'Number of people being taught.', undefined, 'people', 1, 100),
    field('weddingPartyRoutine', 'Wedding-party routine required', 'boolean', 'Whether choreography extends beyond the couple.'),
  ],
  security: [
    field('guards', 'Security guards required', 'number', 'Required guard count if already known.', undefined, 'guards', 1, 200),
    field('hours', 'Security duration', 'number', 'Hours of security coverage.', undefined, 'hours', 1, 48),
    field('accessControl', 'Access control required', 'boolean', 'Whether guest-entry/access management is required.'),
  ],
  childcare: [
    field('children', 'Children requiring care', 'number', 'Number of children requiring childcare.', undefined, 'children', 1, 500),
    field('hours', 'Childcare duration', 'number', 'Required childcare duration.', undefined, 'hours', 1, 24),
    field('youngChildren', 'Infants/toddlers included', 'boolean', 'Whether age-specific carer ratios may be required.'),
    field('activitiesRequired', 'Activities/materials required', 'boolean', 'Whether organised activities should be included.'),
  ],
  'cleaning-sanitation': [
    field('cleaningHours', 'Cleaning labour hours', 'number', 'Expected cleaning duration.', undefined, 'hours', 1, 100),
    field('washroomUnits', 'Portable washroom units', 'number', 'Number of additional sanitation units required.', undefined, 'units', 0, 100),
    field('duringEventService', 'During-event servicing required', 'boolean', 'Whether cleaning/sanitation must be staffed during the event.'),
  ],
  other: [
    field('quantity', 'Required quantity', 'number', 'Relevant item/person/unit quantity for this service.', undefined, 'units', 0, 100000),
    field('serviceHours', 'Required service hours', 'number', 'Time requirement where service duration affects price.', undefined, 'hours', 0, 1000),
    field('requirements', 'Other requirements', 'text', 'Describe any hard requirements that providers must satisfy.'),
  ],
}

export function weddingRequirementFields(category: string): readonly WeddingRequirementField[] {
  return WEDDING_REQUIREMENT_FIELDS[category] ?? WEDDING_REQUIREMENT_FIELDS.other
}

export function assertWeddingRequirementCatalogCoverage(): string[] {
  return PROVIDER_CATEGORIES
    .map((category) => category.value)
    .filter((category) => weddingRequirementFields(category).length === 0)
}
