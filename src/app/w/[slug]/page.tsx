import { WeddingHome } from '@/components/wedding/wedding-home'
export default async function WeddingPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <WeddingHome slug={slug} /> }
