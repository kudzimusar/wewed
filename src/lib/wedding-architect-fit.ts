export type WeddingArchitectFitResult = {
  score: number
  matched: string[]
  mismatched: string[]
  unknown: string[]
}

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
    : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function intersects(a: unknown, b: unknown): boolean | null {
  const left = list(a)
  const right = list(b)
  if (!left.length || !right.length) return null
  return left.some((entry) => right.includes(entry))
}

export function scoreWeddingArchitectFit(input: {
  category: string
  requirements: unknown
  providerDetails: unknown
}): WeddingArchitectFitResult {
  const requirements = object(input.requirements)
  const details = object(input.providerDetails)
  const checks: Array<{ label: string; result: boolean | null }> = []
  const add = (label: string, result: boolean | null) => checks.push({ label, result })

  if (input.category === 'venue') {
    const need = number(requirements.seatedGuests)
    const capacity = number(details.seatedCapacity)
    if (need !== null) add('Seated capacity', capacity === null ? null : capacity >= need)
    if (bool(requirements.accommodationRequired) === true) add('On-site accommodation', list(details.spaces).includes('accommodation'))
    if (bool(requirements.externalCateringRequired) === true) add('External catering', ['external caterers allowed', 'flexible / by agreement'].includes(text(details.cateringPolicy)))
    if (bool(requirements.accessibilityRequired) === true) add('Accessibility', list(details.venueAmenities).some((entry) => entry.includes('accessible')))
  }

  if (input.category === 'planning') {
    const planningType = text(requirements.planningType)
    if (planningType) add('Planning service', list(details.planningTypes).includes(planningType.replace('consultation only', 'consultation')))
    const fee = text(requirements.plannerBudgetStyle)
    if (fee && fee !== 'no preference') add('Planner fee model', text(details.feeModel) === fee)
    if (bool(requirements.destinationSupport) === true) add('Destination planning', list(details.planningTypes).includes('destination planning'))
  }

  if (input.category === 'photography') {
    const hours = number(requirements.coverageHours)
    const maxHours = number(details.coverageHours)
    if (hours !== null) add('Photography coverage', maxHours === null ? null : maxHours >= hours)
    add('Photography style', intersects(requirements.style, details.photographyStyles))
    if (bool(requirements.albumRequired) === true) add('Album', list(details.deliverables).includes('album'))
    if (bool(requirements.engagementSession) === true) add('Engagement session', list(details.deliverables).includes('engagement session'))
  }

  if (input.category === 'videography') {
    const hours = number(requirements.coverageHours)
    const maxHours = number(details.coverageHours)
    if (hours !== null) add('Video coverage', maxHours === null ? null : maxHours >= hours)
    if (bool(requirements.livestreamRequired) === true) add('Livestream', text(details.livestreaming) === 'yes')
    if (bool(requirements.dronePreferred) === true) add('Drone', text(details.drone).startsWith('yes'))
    if (bool(requirements.fullCeremonyFilm) === true) add('Full ceremony film', list(details.filmStyles).includes('full ceremony'))
  }

  if (input.category === 'florals') {
    const preference = text(requirements.flowerPreference)
    if (preference.includes('fresh')) add('Fresh flowers', list(details.flowerTypes).includes('fresh'))
    if (bool(requirements.ceremonyInstallation) === true) add('Ceremony installation', list(details.floralServices).some((entry) => entry.includes('arch') || entry.includes('installation')))
  }

  if (input.category === 'catering') {
    const serviceStyle = text(requirements.serviceStyle)
    if (serviceStyle && serviceStyle !== 'no preference') add('Catering service style', list(details.serviceStyles).includes(serviceStyle))
    add('Cuisine', intersects(requirements.cuisines, details.cuisines))
    const requiredDietary = list(requirements.dietarySupport)
    if (requiredDietary.length) {
      const supported = list(details.dietarySupport)
      add('Dietary support', requiredDietary.every((entry) => supported.includes(entry)))
    }
    const adults = number(requirements.adultGuests) ?? 0
    const children = number(requirements.childGuests) ?? 0
    const guests = adults + children
    const min = number(details.minimumGuests)
    const max = number(details.maximumGuests)
    if (guests > 0 && min !== null) add('Catering minimum guests', guests >= min)
    if (guests > 0 && max !== null) add('Catering maximum guests', guests <= max)
  }

  if (input.category === 'cakes') {
    const servings = number(requirements.servings)
    const min = number(details.servingMinimum)
    const max = number(details.servingMaximum)
    if (servings !== null && min !== null) add('Cake minimum servings', servings >= min)
    if (servings !== null && max !== null) add('Cake maximum servings', servings <= max)
    const dietary = list(requirements.dietaryOptions)
    if (dietary.length) add('Cake dietary options', dietary.every((entry) => list(details.dietaryOptions).includes(entry)))
  }

  if (input.category === 'entertainment') add('Entertainment type', intersects(requirements.entertainmentType, details.performerTypes))

  // Generic exact-key comparisons extend the score safely when both sides use
  // the same structured vocabulary. Unknown fields never count as a mismatch.
  for (const [key, required] of Object.entries(requirements)) {
    if (!(key in details) || required === null || required === undefined || required === '') continue
    if (checks.some((check) => check.label.toLowerCase().replace(/[^a-z]/g, '').includes(key.toLowerCase().replace(/[^a-z]/g, '')))) continue
    const provided = details[key]
    if (typeof required === 'boolean') add(key, typeof provided === 'boolean' ? provided === required : null)
    else if (Array.isArray(required)) add(key, intersects(required, provided))
    else if (typeof required === 'string' && required.trim()) add(key, text(provided) ? text(provided) === text(required) : null)
  }

  const known = checks.filter((check) => check.result !== null)
  const matched = known.filter((check) => check.result === true).map((check) => check.label)
  const mismatched = known.filter((check) => check.result === false).map((check) => check.label)
  const unknown = checks.filter((check) => check.result === null).map((check) => check.label)
  const score = known.length === 0 ? 70 : Math.round((matched.length / known.length) * 100)
  return { score, matched, mismatched, unknown }
}
