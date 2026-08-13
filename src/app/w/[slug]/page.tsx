import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { WeddingHome } from '@/components/wedding/wedding-home'
import { GuestAccessGateway } from '@/components/wedding/guest-access-gateway'
import {
  APP_SESSION_COOKIE,
  verifyAppSessionToken,
} from '@/lib/app-session'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { loadWeddingDataBySlug } from '@/lib/wedding-data-server'
import { WEDDING_GUEST_SESSION_COOKIE } from '@/lib/wedding-guest-session'
import {
  loadWeddingAccessRecord,
  resolveWeddingAccessFromTokens,
} from '@/lib/wedding-public-access'
import type { WeddingViewerRole } from '@/lib/wedding-access-kind'

interface WeddingPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    rsvp?: string
    invitation?: string
    card?: string
    accessError?: string
  }>
}

async function accessForSlug(slug: string) {
  const cookieStore = await cookies()
  return resolveWeddingAccessFromTokens({
    slug,
    appSessionToken: cookieStore.get(APP_SESSION_COOKIE)?.value ?? null,
    guestSessionToken:
      cookieStore.get(WEDDING_GUEST_SESSION_COOKIE)?.value ?? null,
  })
}

export async function generateMetadata({ params }: WeddingPageProps): Promise<Metadata> {
  const { slug } = await params
  const resolution = await accessForSlug(slug)

  if (!resolution.wedding) {
    return {
      title: 'Wedding not found | Wewed',
      description: 'This Wewed wedding site is unavailable.',
      robots: { index: false, follow: false },
    }
  }

  const wedding = resolution.wedding
  if (!resolution.allowed || wedding.privacy !== 'public') {
    const title = 'Private wedding | Wewed'
    const description =
      'A private Wewed wedding site shared only with authorized people.'
    return {
      title,
      description,
      keywords: ['Wewed', 'private wedding invitation'],
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary', title, description },
    }
  }

  const names = `${wedding.partner1} & ${wedding.partner2}`
  const title = `${names} | Wewed`
  const description =
    wedding.tagline || `Celebrate ${names} on their Wewed wedding site.`
  return {
    title,
    description,
    keywords: ['Wewed', 'wedding', names],
    robots: { index: true, follow: true },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function WeddingPage({
  params,
  searchParams,
}: WeddingPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const wedding = await loadWeddingAccessRecord(slug)
  if (!wedding) notFound()

  const invitationToken = query.rsvp?.trim()
  if (invitationToken) {
    const exchangeQuery = new URLSearchParams({ token: invitationToken })
    if (query.card) {
      exchangeQuery.set('card', normalizeInvitationCardStyle(query.card))
    }
    redirect(
      `/api/weddings/${encodeURIComponent(slug)}/guest-session/exchange?${exchangeQuery.toString()}`,
    )
  }

  const cookieStore = await cookies()
  const appSessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value ?? null
  const guestSessionToken =
    cookieStore.get(WEDDING_GUEST_SESSION_COOKIE)?.value ?? null
  const [resolution, appSession] = await Promise.all([
    resolveWeddingAccessFromTokens({
      slug,
      appSessionToken,
      guestSessionToken,
    }),
    Promise.resolve(appSessionToken ? verifyAppSessionToken(appSessionToken) : null),
  ])

  if (!resolution.allowed) {
    return (
      <GuestAccessGateway
        slug={slug}
        privacy={wedding.privacy}
        accessError={query.accessError ?? null}
      />
    )
  }

  const initialData = await loadWeddingDataBySlug(slug)
  if (!initialData) notFound()

  const viewerRole: WeddingViewerRole =
    appSession?.activeWeddingId === wedding.id ? appSession.role : null

  return (
    <WeddingHome
      slug={slug}
      accessKind={resolution.accessKind}
      viewerRole={viewerRole}
      initialData={initialData}
    />
  )
}

export const dynamic = 'force-dynamic'
