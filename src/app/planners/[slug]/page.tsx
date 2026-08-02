import { PublicPlannerProfile } from '@/components/marketplace/public-planner-profile'
export default async function PlannerProfilePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicPlannerProfile slug={slug} /> }
