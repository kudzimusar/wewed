import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { APP_SESSION_COOKIE, verifyAppSessionToken } from '@/lib/app-session'
import { contextHasPermission, getWeddingContextForSession } from '@/lib/wedding-access'
import { loadWeddingAccessRecord } from '@/lib/wedding-public-access'
import { loadEditorSite } from '@/lib/wedding-site/server'
import { SiteEditor } from '@/components/wedding/site-editor/site-editor'

export const metadata: Metadata = {
  title: 'Edit wedding website | Wewed',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * QRO07-SHIP01 — the owner/planner website editor. Access is decided here on the server from an
 * active membership with content.edit for THIS wedding; every write goes through the
 * wedding-scoped /api/weddings/[slug]/site* routes, which re-check the same permission.
 */
export default async function EditWeddingSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const wedding = await loadWeddingAccessRecord(slug)
  if (!wedding) notFound()

  const cookieStore = await cookies()
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value ?? null
  const session = token ? verifyAppSessionToken(token) : null
  const context = session?.activeWeddingId === wedding.id ? await getWeddingContextForSession(session) : null
  const allowed = Boolean(context && context.weddingId === wedding.id && contextHasPermission(context, 'content.edit'))

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory px-5">
        <div className="max-w-md text-center">
          <h1 className="wewed-heading text-3xl font-light text-espresso">Website editing</h1>
          <p className="mt-4 font-sans text-sm leading-6 text-espresso/70">
            Only the couple and planners with website-editing access for this wedding can edit it. Sign in with that
            account and make this wedding your active wedding.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full bg-espresso px-5 text-sm text-champagne">
              Sign in
            </Link>
            <Link href={`/w/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center rounded-full border border-gold/40 px-5 text-sm text-espresso">
              View website
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const initial = await loadEditorSite(wedding.id)
  return <SiteEditor slug={slug} initial={initial} />
}
