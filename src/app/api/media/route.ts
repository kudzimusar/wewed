import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'
import {
  resolvePrivateWeddingMediaUrl,
  resolvePrivateWeddingMediaUrls,
  uploadPrivateWeddingMedia,
  weddingMediaStorageConfigured,
} from '@/lib/wedding-media-storage'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}
const MOMENT_VALUES = new Set(['ceremony', 'reception', 'candid', 'preparation', 'group_photo'])

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

async function accessForRequest(request: NextRequest, explicit?: string | null) {
  const slug = weddingSlugFromRequest(request, explicit)
  if (!slug) {
    return {
      access: null,
      error: noStore(NextResponse.json({ success: false, error: 'Wedding route context is required.' }, { status: 400 })),
    }
  }
  const access = await resolveWeddingAccessForRequest(request, slug)
  if (!access.allowed || !access.wedding) {
    return {
      access: null,
      error: noStore(NextResponse.json(weddingAccessErrorPayload(access), { status: access.status })),
    }
  }
  return { access, error: null }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await accessForRequest(request)
    if (resolved.error) return resolved.error

    const { searchParams } = request.nextUrl
    const moment = searchParams.get('moment')
    const type = searchParams.get('type')
    const curated = searchParams.get('curated')
    const limit = searchParams.get('limit')
      ? Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 12))
      : undefined
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    const where: Record<string, unknown> = { weddingId: resolved.access.wedding.id }
    if (moment && MOMENT_VALUES.has(moment)) where.moment = moment
    if (type && ['photo', 'video', 'document'].includes(type)) where.type = type
    if (curated === 'true') where.isCurated = true
    if (curated === 'false') where.isCurated = false

    const media = await db.mediaItem.findMany({
      where,
      orderBy: [{ isHero: 'desc' }, { uploadedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    })

    const serialized = media.map((item) => ({
      ...item,
      uploadedAt: item.uploadedAt?.toISOString() ?? null,
    }))
    const resolvedMedia = await resolvePrivateWeddingMediaUrls(serialized)

    return noStore(NextResponse.json({
      success: true,
      source: 'database',
      count: resolvedMedia.length,
      data: resolvedMedia,
    }))
  } catch (error) {
    console.error('[MEDIA GET] Error:', error)
    return noStore(NextResponse.json({ success: false, error: 'Failed to load wedding media.' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const explicitSlug = (form.get('slug') as string | null)?.trim() || null
    const resolved = await accessForRequest(request, explicitSlug)
    if (resolved.error) return resolved.error

    if (resolved.access.accessKind === 'public') {
      return noStore(NextResponse.json(
        { success: false, error: 'Open your personal invitation before uploading wedding media.' },
        { status: 403 },
      ))
    }

    const file = form.get('file')
    const caption = (form.get('caption') as string | null)?.trim() || null
    const rawMoment = (form.get('moment') as string | null)?.trim() || null

    if (!file || !(file instanceof File)) {
      return noStore(NextResponse.json({ success: false, error: 'A file is required.' }, { status: 400 }))
    }
    if (file.size > MAX_FILE_SIZE) {
      return noStore(NextResponse.json({ success: false, error: 'File is too large. Maximum size is 10 MB.' }, { status: 413 }))
    }

    const extension = ALLOWED_MIME[file.type]
    if (!extension) {
      return noStore(NextResponse.json({ success: false, error: 'Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, MP4 and WEBM.' }, { status: 415 }))
    }

    const moment = rawMoment && MOMENT_VALUES.has(rawMoment) ? rawMoment : 'candid'
    const type: 'photo' | 'video' = file.type.startsWith('image/') ? 'photo' : 'video'
    const filename = `${randomUUID()}${extension}`
    const bytes = await file.arrayBuffer()
    let storedUrl: string

    if (weddingMediaStorageConfigured()) {
      storedUrl = await uploadPrivateWeddingMedia({
        weddingId: resolved.access.wedding.id,
        type,
        filename,
        bytes,
        contentType: file.type,
      })
    } else if (process.env.NODE_ENV !== 'production') {
      const weddingUploadDir = path.join(UPLOAD_DIR, resolved.access.wedding.slug)
      await fs.mkdir(weddingUploadDir, { recursive: true })
      await fs.writeFile(path.join(weddingUploadDir, filename), Buffer.from(bytes))
      storedUrl = `/uploads/${resolved.access.wedding.slug}/${filename}`
    } else {
      return noStore(NextResponse.json(
        {
          success: false,
          error: 'Wedding media storage is not configured. Upload was not accepted.',
        },
        { status: 503 },
      ))
    }

    try {
      const media = await db.mediaItem.create({
        data: {
          type,
          url: storedUrl,
          thumbnailUrl: type === 'video' ? null : storedUrl,
          caption,
          moment,
          isCurated: false,
          isHero: false,
          uploaderId: resolved.access.guest?.id ?? null,
          uploadedAt: new Date(),
          weddingId: resolved.access.wedding.id,
        },
      })

      const [publicUrl, publicThumbnailUrl] = await Promise.all([
        resolvePrivateWeddingMediaUrl(media.url),
        media.thumbnailUrl ? resolvePrivateWeddingMediaUrl(media.thumbnailUrl) : Promise.resolve(null),
      ])

      return noStore(NextResponse.json({
        success: true,
        media: {
          ...media,
          url: publicUrl || media.url,
          thumbnailUrl: media.thumbnailUrl ? publicThumbnailUrl || media.thumbnailUrl : null,
          uploadedAt: media.uploadedAt?.toISOString() ?? null,
        },
      }, { status: 201 }))
    } catch (error) {
      console.error('[MEDIA POST] Database/signing error after storage upload:', error)
      throw error
    }
  } catch (error) {
    console.error('[MEDIA POST] Error:', error)
    return noStore(NextResponse.json({ success: false, error: 'Failed to upload wedding media.' }, { status: 500 }))
  }
}
