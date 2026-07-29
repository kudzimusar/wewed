export const CLIENT_PROFILE_TEXT_LIMIT = 4000

export function cleanText(value: unknown, maxLength = CLIENT_PROFILE_TEXT_LIMIT): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function cleanOptionalText(
  value: unknown,
  maxLength = CLIENT_PROFILE_TEXT_LIMIT,
): string | null {
  const text = cleanText(value, maxLength)
  return text || null
}

export function cleanUrl(
  value: unknown,
  options: { allowRelative?: boolean; allowHttp?: boolean } = {},
): string | null {
  const raw = cleanText(value, 2000)
  if (!raw) return null

  if (options.allowRelative && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }

  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || (options.allowHttp && url.protocol === 'http:')) {
      return url.toString()
    }
  } catch {
    return null
  }

  return null
}

export function cleanStringList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 240))
        .filter(Boolean),
    ),
  ).slice(0, maxItems)
}

export function buildMapsSearchUrl(parts: Array<string | null | undefined>): string {
  const query = parts.map((part) => part?.trim()).filter(Boolean).join(', ')
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : ''
}

export interface ClientProfileCompletenessInput {
  partner1?: string | null
  partner2?: string | null
  title?: string | null
  date?: string | Date | null
  venue?: string | null
  venueCity?: string | null
  venueCountry?: string | null
  venueMapUrl?: string | null
  venueAddress?: string | null
  venuePhone?: string | null
  venueDescription?: string | null
}

export function clientProfileCompleteness(input: ClientProfileCompletenessInput): {
  complete: number
  total: number
  percent: number
  missing: string[]
} {
  const fields: Array<[string, unknown]> = [
    ['Partner one', input.partner1],
    ['Partner two', input.partner2],
    ['Wedding title', input.title],
    ['Wedding date', input.date],
    ['Venue name', input.venue],
    ['Venue city', input.venueCity],
    ['Venue country', input.venueCountry],
    ['Venue address', input.venueAddress],
    ['Venue directions', input.venueMapUrl],
    ['Venue phone', input.venuePhone],
    ['Venue description', input.venueDescription],
  ]

  const missing = fields
    .filter(([, value]) => value == null || String(value).trim() === '')
    .map(([label]) => label)
  const total = fields.length
  const complete = total - missing.length

  return {
    complete,
    total,
    percent: Math.round((complete / total) * 100),
    missing,
  }
}
