import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Store } from 'lucide-react'
import { BookingCommerceError, getPublicCatalogItem } from '@/lib/booking-commerce'
import { ProviderBookingFormV2 } from '@/components/providers/provider-booking-form-v2'
import { ProviderShareQrButton } from '@/components/providers/provider-share-qr-button'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string; itemSlug: string }>
  searchParams: Promise<{ ref?: string | string[] }>
}

async function load(slug: string, itemSlug: string) {
  try { return await getPublicCatalogItem(slug, itemSlug) } catch (error) {
    if (error instanceof BookingCommerceError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, itemSlug } = await params
  try {
    const { provider, item } = await getPublicCatalogItem(slug, itemSlug)
    const image = item.media.find((entry: { type: string }) => entry.type === 'image')?.url || provider.coverImageUrl || undefined
    const title = `${item.name} — ${provider.displayName} | Wewed`
    const description = item.description || `View ${item.name}, check booking options and contact ${provider.displayName} through Wewed.`
    const url = `https://wewed.pro/vendors/${encodeURIComponent(provider.slug)}/book/${encodeURIComponent(item.slug)}`
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, type: 'website', images: image ? [{ url: image }] : undefined },
      twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
    }
  } catch { return { title: 'Book a wedding service | Wewed' } }
}

export default async function ProviderBookableItemPage({ params, searchParams }: PageProps) {
  const { slug, itemSlug } = await params
  const query = await searchParams
  const { provider, item } = await load(slug, itemSlug)
  const referralToken = Array.isArray(query.ref) ? query.ref[0] : query.ref || null
  return (
    <main className="min-h-screen bg-[#f7f2ea] pb-14 text-[#211a15]">
      <div className="sticky top-0 z-40 border-b border-[#e4d8c8] bg-[#fbf8f3]/96 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/vendors/${encodeURIComponent(provider.slug)}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#ddd0bf] bg-white text-[#55483e]" aria-label={`Back to ${provider.displayName}`}><ArrowLeft className="size-4" /></Link>
            <div className="min-w-0"><Link href={`/vendors/${encodeURIComponent(provider.slug)}`} className="block truncate text-sm font-bold text-[#32445d]">{provider.displayName}</Link><Link href="/vendors" className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#8f7450]"><Store className="size-3" /> Vendor marketplace</Link></div>
          </div>
          <ProviderShareQrButton slug={provider.slug} itemSlug={item.slug} compact />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <ProviderBookingFormV2 providerSlug={provider.slug} providerName={provider.displayName} item={item} referralToken={referralToken} />
      </div>
    </main>
  )
}
