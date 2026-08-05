export interface PlannerPackage {
  name: string
  description: string | null
  startingPrice: number | null
  currency: string
  pricingUnit: string | null
  inclusions: string[]
}

export interface PlannerFaq {
  question: string
  answer: string
}

export interface PublicPlannerProfile {
  id: string
  slug: string
  displayName: string
  headline: string | null
  bio: string | null
  yearsExperience: number | null
  completedWeddings: number | null
  teamSize: number | null
  serviceAreas: string[]
  services: string[]
  weddingStyles: string[]
  languages: string[]
  priceBand: string
  minimumGuestCount: number | null
  maximumGuestCount: number | null
  availabilityStatus: string
  portfolio: string[]
  profileDetails: Record<string, unknown>
  packages: PlannerPackage[]
  faq: PlannerFaq[]
  verificationBadges: string[]
  publishedAt: string | null
  lastProfileUpdate: string | null
}

export interface PlannerEnquiry {
  id: string
  status: string
  plannerProfileId: string
  plannerDisplayName?: string
  plannerSlug?: string
  weddingTitle?: string
  weddingSlug?: string
  weddingDate: string
  location: string
  guestCountMin: number | null
  guestCountMax: number | null
  budgetBand: string
  weddingStyles: string[] | string
  services: string[] | string
  message: string | null
  plannerResponse: string | null
  sharedSummary?: Record<string, unknown>
  createdAt: string
}

export interface PlannerEngagement {
  id: string
  status: string
  weddingId: string
  weddingTitle?: string
  weddingSlug?: string
  plannerDisplayName?: string
  plannerSlug?: string
  authorityBundle: string | null
  permissions: string[] | string
  sharedSummary?: Record<string, unknown>
  message?: string | null
  authorizedAt?: string | null
  createdAt: string
}

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

export function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function marketplaceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'The marketplace request failed.')
  return payload
}
