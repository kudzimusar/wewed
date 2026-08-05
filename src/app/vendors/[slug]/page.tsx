import type { Metadata } from 'next'
import { PublicProviderProfile } from '@/components/providers/public-provider-profile'
import { db } from '@/lib/db'

type Props = { params: Promise<{ slug: string }> }

async function metadataFor(slug: string) {
  const rows = await db.$queryRawUnsafe<Array<{ displayName: string; headline: string | null; description: string | null }>>(
    `SELECT p."displayName", p.headline, p.description
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
  const description = profile.headline || profile.description?.slice(0, 160) || `View ${profile.displayName}'s wedding service profile on Wewed.`
  return { title, description, openGraph: { title, description, type: 'profile' }, twitter: { card: 'summary', title, description } }
}

export default async function ProviderProfilePage({ params }: Props) {
  const { slug } = await params
  return <PublicProviderProfile slug={slug} />
}

export const dynamic = 'force-dynamic'
