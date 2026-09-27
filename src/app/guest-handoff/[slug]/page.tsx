import type { Metadata } from 'next'
import { GuestBrowserHandoff } from './guest-browser-handoff'

export const metadata: Metadata = {
  title: 'Opening your wedding · Wewed',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

interface Props {
  params: Promise<{ slug: string }>
}

/** QRO06 — browser entry for the native → browser Guest handoff (see guest-browser-handoff.ts). */
export default async function GuestHandoffPage({ params }: Props) {
  const { slug } = await params
  return <GuestBrowserHandoff slug={slug} />
}
