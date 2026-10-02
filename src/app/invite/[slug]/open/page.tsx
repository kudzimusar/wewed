import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { InvitationAppHandoff } from '@/components/wedding/invitation-app-handoff'
import { db } from '@/lib/db'
import { WEWED_BRAND_PAYOFF, WEWED_INVITATION_PREVIEW_TITLE } from '@/lib/wewed-brand'
import { invitationPreviewDescription } from '@/lib/invitation-link-preview'
import {
  PENDING_INVITATION_COOKIE,
  verifyPendingInvitationToken,
} from '@/lib/pending-invitation'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const wedding = await db.wedding.findUnique({
    where: { slug },
    select: { title: true, date: true },
  })

  if (!wedding) {
    return {
      title: WEWED_INVITATION_PREVIEW_TITLE,
      description: `A secure private wedding invitation from Wewed — ${WEWED_BRAND_PAYOFF}`,
      robots: { index: false, follow: false },
    }
  }

  const description = invitationPreviewDescription(wedding)

  return {
    title: WEWED_INVITATION_PREVIEW_TITLE,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: WEWED_INVITATION_PREVIEW_TITLE,
      description,
      type: 'website',
      siteName: 'Wewed',
      images: [
        {
          url: '/og/wewed-private-invitation.png',
          width: 1200,
          height: 630,
          alt: 'Wewed private wedding invitation',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: WEWED_INVITATION_PREVIEW_TITLE,
      description,
      images: ['/og/wewed-private-invitation.png'],
    },
  }
}

export default async function InvitationOpenPage({ params }: Props) {
  const { slug } = await params
  const cookieStore = await cookies()
  const encoded = cookieStore.get(PENDING_INVITATION_COOKIE)?.value
  const pending = encoded ? verifyPendingInvitationToken(encoded) : null

  if (!pending || pending.weddingSlug !== slug) {
    redirect(`/w/${encodeURIComponent(slug)}?accessError=missing`)
  }

  const wedding = await db.wedding.findUnique({
    where: { slug },
    select: { id: true, title: true },
  })

  if (!wedding) {
    redirect('/guest-access-help?reason=invalid-invitation')
  }

  const dedicatedUat =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === wedding.id

  // Android v14+ already contains the Play Install Referrer receiver, so production no longer
  // needs an opt-in flag to expose the install continuity path. Keep an explicit "0" kill switch
  // for emergency rollback, and retain the dedicated writable-preview gate for UAT.
  const productionDeferredInstallEnabled =
    process.env.VERCEL_ENV === 'production' &&
    process.env.ANDROID_DEFERRED_INVITATION_HANDOFF !== '0'
  const deferredInstallEnabled =
    dedicatedUat ||
    productionDeferredInstallEnabled ||
    process.env.ANDROID_DEFERRED_INVITATION_HANDOFF === '1'

  return (
    <InvitationAppHandoff
      weddingSlug={slug}
      weddingTitle={wedding.title}
      deferredInstallEnabled={deferredInstallEnabled}
    />
  )
}
