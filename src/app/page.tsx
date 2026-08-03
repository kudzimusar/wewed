import { redirect } from 'next/navigation'
import { PublicPlatformHome } from '@/components/public/public-platform-home'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ wedding?: string; rsvp?: string }>
}) {
  const query = await searchParams
  const wedding = query.wedding?.trim()
  const rsvp = query.rsvp?.trim()

  if (wedding) {
    redirect(`/w/${encodeURIComponent(wedding)}${rsvp ? `?rsvp=${encodeURIComponent(rsvp)}` : ''}`)
  }

  if (rsvp) {
    redirect(`/w/charity-and-kudzie?rsvp=${encodeURIComponent(rsvp)}`)
  }

  return <PublicPlatformHome />
}
