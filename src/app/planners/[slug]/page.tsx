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
    return {
      title: 'Planner Profile | Wewed',
      description: 'View a verified wedding planner profile in the Wewed marketplace.',
      robots: { index: false, follow: false },
    }
  }

  const description = profile.headline
    || profile.bio?.slice(0, 160)
    || `View ${profile.displayName}'s verified wedding planner profile in the Wewed marketplace.`

  return {
    title: `${profile.displayName} | Wewed Planner Marketplace`,
    description,
    openGraph: {
      title: `${profile.displayName} | Wewed Planner Marketplace`,
      description,
      type: 'profile',
    },
  }
}

export default async function PlannerProfilePage({ params }: PlannerProfilePageProps) {
  const { slug } = await params
  return <PublicPlannerProfile slug={slug} />
}

export const dynamic = 'force-dynamic'
