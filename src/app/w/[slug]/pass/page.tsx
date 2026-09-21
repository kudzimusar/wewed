import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { WeddingPassCard } from '@/components/wedding/wedding-pass-card'
import { db } from '@/lib/db'
import {
  WEDDING_GUEST_SESSION_COOKIE,
  verifyWeddingGuestSessionToken,
} from '@/lib/wedding-guest-session'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WeddingPassPage({ params }: Props) {
  const { slug } = await params
  const cookieStore = await cookies()
  const encoded = cookieStore.get(WEDDING_GUEST_SESSION_COOKIE)?.value
  const guestSession = encoded ? verifyWeddingGuestSessionToken(encoded) : null
  if (!guestSession) {
    redirect(`/w/${encodeURIComponent(slug)}?accessError=missing`)
  }

  const wedding = await db.wedding.findUnique({
    where: { id: guestSession.weddingId },
    select: { slug: true },
  })
  if (!wedding) notFound()
  if (wedding.slug !== slug) {
    redirect(`/w/${encodeURIComponent(slug)}?accessError=invalid`)
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6 sm:py-12">
      <WeddingPassCard slug={slug} />
    </main>
  )
}

export const dynamic = 'force-dynamic'
