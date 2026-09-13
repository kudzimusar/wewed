import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { InvitationAppHandoff } from '@/components/wedding/invitation-app-handoff'
import { db } from '@/lib/db'
import {
  PENDING_INVITATION_COOKIE,
  verifyPendingInvitationToken,
} from '@/lib/pending-invitation'

interface Props {
  params: Promise<{ slug: string }>
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
  const deferredInstallEnabled =
    dedicatedUat || process.env.ANDROID_DEFERRED_INVITATION_HANDOFF === '1'

  return (
    <InvitationAppHandoff
      weddingSlug={slug}
      weddingTitle={wedding.title}
      deferredInstallEnabled={deferredInstallEnabled}
    />
  )
}
