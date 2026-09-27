import { NextRequest } from 'next/server'
import { noStoreJson, requireGrantPermission, requireWeddingScope, resolveNativeGrantContext } from '@/lib/native-domain-context'
import { loadPublishedAnnouncements } from '@/lib/wedding-site/server'

/**
 * QRO07-SHIP01 — Wedding Day announcements for native staff workspaces. The same published
 * WeddingAnnouncement projection the website and the guest Wedding Day read; staff see notices for
 * every guest audience. Read-only: announcements are authored in the website editor.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'timeline.view')
  if (!permission.ok) return permission.response

  const announcements = await loadPublishedAnnouncements(scope.weddingId, { includeAttendingOnly: true })
  return noStoreJson({ success: true, count: announcements.length, data: announcements })
}
