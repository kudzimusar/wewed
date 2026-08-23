import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, QrCode } from 'lucide-react'
import { BookingCommerceError, getPublicCatalogItem } from '@/lib/booking-commerce'
import { ProviderBookingForm } from '@/components/providers/provider-booking-form'

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
    <main className="min-h-screen bg-slate-50 pb-14">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href={`/vendors/${encodeURIComponent(provider.slug)}`} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700"><ArrowLeft className="h-4 w-4" /> {provider.displayName}</Link>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><QrCode className="h-4 w-4" /> wewed.pro booking</div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-7">
        <ProviderBookingForm providerSlug={provider.slug} providerName={provider.displayName} item={item} referralToken={referralToken} />
      </div>
    </main>
  )
}
