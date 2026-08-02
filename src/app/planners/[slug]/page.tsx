import type { Metadata } from 'next'
import { PublicPlannerProfile } from '@/components/marketplace/public-planner-profile'
import { db } from '@/lib/db'

type PlannerMetadataRow = {
  displayName: string
  headline: string | null
  bio: string | null
}

type PlannerProfilePageProps = {
  params: Promise<{ slug: string }>
}

async function publicPlannerMetadata(slug: string): Promise<PlannerMetadataRow | null> {
  const rows = await db.$queryRawUnsafe<PlannerMetadataRow[]>(
    `SELECT p."displayName", p.headline, p.bio
     FROM public."PlannerProfile" p
     JOIN public."BusinessAccount" ba ON ba.id = p."businessAccountId"
     WHERE p.slug = $1
       AND p.status = 'published'
       AND ba.type = 'planning_company'
       AND ba.status = 'active'
       AND ba."onboardingStatus" = 'complete'
     LIMIT 1`,
    slug,
  )
  return rows[0] ?? null
}

export async function generateMetadata({ params }: PlannerProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const profile = await publicPlannerMetadata(slug)

  if (!profile) {
    const title = 'Planner Profile | Wewed'
    const description = 'View a verified wedding planner profile in the Wewed marketplace.'
    return {
      title,
      description,
      keywords: ['Wewed', 'wedding planner', 'planner marketplace'],
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary', title, description },
    }
  }

  const title = `${profile.displayName} | Wewed Planner Marketplace`
  const description = profile.headline
    || profile.bio?.slice(0, 160)
    || `View ${profile.displayName}'s verified wedding planner profile in the Wewed marketplace.`

  return {
    title,
    description,
    keywords: ['Wewed', 'wedding planner', 'planner marketplace', profile.displayName],
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function PlannerProfilePage({ params }: PlannerProfilePageProps) {
  const { slug } = await params
  return <PublicPlannerProfile slug={slug} />
}

export const dynamic = 'force-dynamic'
