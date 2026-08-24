import type { Metadata } from 'next'
import { PublicProviderProfile } from '@/components/providers/public-provider-profile'
import { ProviderBookingShowcaseV2 } from '@/components/providers/provider-booking-showcase-v2'
import { db } from '@/lib/db'

type Props = { params: Promise<{ slug: string }> }

async function metadataFor(slug: string) {
  const rows = await db.$queryRawUnsafe<Array<{ displayName: string; headline: string | null; description: string | null; coverImageUrl: string | null }>>(
    `SELECT p."displayName", p.headline, p.description, p."coverImageUrl"
     FROM public."ProviderProfile" p
     JOIN public."BusinessAccount" ba
       ON ba.id=p."businessAccountId"
      AND ba.type IN ('venue','vendor')
      AND ba.status='active'
      AND ba."onboardingStatus"='complete'
     WHERE p.slug=$1 AND p.visibility='published'
     LIMIT 1`,
    slug,
  )
  return rows[0] ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const profile = await metadataFor(slug)
  if (!profile) return { title: 'Wedding Provider | Wewed', description: 'View an approved wedding service provider on Wewed.', robots: { index: false, follow: false } }
  const title = `${profile.displayName} | Wewed Wedding Providers`
  const description = profile.headline || profile.description?.slice(0, 160) || `View ${profile.displayName}'s wedding service profile, catalogue and booking options on Wewed.`
  const url = `https://wewed.pro/vendors/${encodeURIComponent(slug)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'profile', url, images: profile.coverImageUrl ? [{ url: profile.coverImageUrl }] : undefined },
    twitter: { card: profile.coverImageUrl ? 'summary_large_image' : 'summary', title, description, images: profile.coverImageUrl ? [profile.coverImageUrl] : undefined },
  }
}

export default async function ProviderProfilePage({ params }: Props) {
  const { slug } = await params
  const profile = await metadataFor(slug)
  return (
    <>
      <PublicProviderProfile slug={slug} />
      <ProviderBookingShowcaseV2 slug={slug} fallbackCover={profile?.coverImageUrl} />
    </>
  )
}

export const dynamic = 'force-dynamic'
