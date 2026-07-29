export const LEGACY_VENDOR_META_PREFIX = '__wewed_meta__:'

export interface LegacyVendorMeta {
  contact?: string
  contractStatus?: string
  paymentStatus?: string
  rating?: number
  notes?: string
}

export interface LegacyTimelineMeta {
  d?: string
  l?: string
  i?: string
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function ratingValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5
    ? value
    : undefined
}

export function decodeLegacyVendorDescription(description: string | null): {
  meta: LegacyVendorMeta
  humanDescription: string | null
  encoded: boolean
} {
  if (!description) return { meta: {}, humanDescription: null, encoded: false }
  if (!description.startsWith(LEGACY_VENDOR_META_PREFIX)) {
    return { meta: {}, humanDescription: description, encoded: false }
  }

  const [blob, ...humanParts] = description
    .slice(LEGACY_VENDOR_META_PREFIX.length)
    .split('|||')
  const humanDescription = humanParts.length ? humanParts.join('|||') || null : null

  try {
    const parsed = JSON.parse(blob) as Record<string, unknown>
    return {
      encoded: true,
      humanDescription,
      meta: {
        contact: stringValue(parsed.contact),
        contractStatus: stringValue(parsed.contractStatus),
        paymentStatus: stringValue(parsed.paymentStatus),
        rating: ratingValue(parsed.rating),
        notes: stringValue(parsed.notes),
      },
    }
  } catch {
    // Never expose an internal sentinel to a planner or public wedding response.
    return { meta: {}, humanDescription, encoded: true }
  }
}

export function encodeLegacyVendorDescription(
  description: string | null,
  meta: LegacyVendorMeta,
): string {
  const human = description?.trim() || ''
  return `${LEGACY_VENDOR_META_PREFIX}${JSON.stringify(meta)}${human ? `|||${human}` : ''}`
}

export function decodeLegacyTimelineIcon(icon: string | null): {
  duration: string
  location: string
  icon: string | null
  encoded: boolean
} {
  if (!icon) return { duration: '', location: '', icon: null, encoded: false }
  if (!icon.startsWith('{')) {
    return { duration: '', location: '', icon, encoded: false }
  }

  try {
    const parsed = JSON.parse(icon) as Record<string, unknown>
    return {
      duration: stringValue(parsed.d) ?? '',
      location: stringValue(parsed.l) ?? '',
      icon: stringValue(parsed.i) ?? null,
      encoded: true,
    }
  } catch {
    // Preserve an old plain icon value that happens to begin with a brace.
    return { duration: '', location: '', icon, encoded: false }
  }
}

export function encodeLegacyTimelineIcon(meta: LegacyTimelineMeta): string | null {
  const duration = stringValue(meta.d) ?? ''
  const location = stringValue(meta.l) ?? ''
  const icon = stringValue(meta.i) ?? ''
  if (!duration && !location && !icon) return null
  return JSON.stringify({
    ...(duration ? { d: duration } : {}),
    ...(location ? { l: location } : {}),
    ...(icon ? { i: icon } : {}),
  })
}

export function publicVendorDescription(description: string | null): string | null {
  return decodeLegacyVendorDescription(description).humanDescription
}

export function publicTimelineMetadata(icon: string | null): {
  icon: string | null
  duration: string
  location: string
} {
  const decoded = decodeLegacyTimelineIcon(icon)
  return {
    icon: decoded.icon,
    duration: decoded.duration,
    location: decoded.location,
  }
}
