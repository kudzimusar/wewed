import { NextRequest, NextResponse } from 'next/server'
import { buildCoupleExportManifest, Phase5MediaError } from '@/lib/media/phase5'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'export.data')
  if (access.error) return access.error
  try {
    const manifest = await buildCoupleExportManifest({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
    })
    const response = NextResponse.json(manifest)
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    response.headers.set('Vary', 'Cookie')
    response.headers.set('Content-Disposition', `attachment; filename="wewed-${manifest.wedding.slug}-media-manifest.json"`)
    return response
  } catch (error) {
    if (error instanceof Phase5MediaError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[MEDIA ARCHIVE EXPORT] error:', error)
    return NextResponse.json({ success: false, error: 'Wewed could not create the media export manifest.' }, { status: 500 })
  }
}
