import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const WEDDING_MEDIA_BUCKET = 'wedding-media'
const STORAGE_URI_PREFIX = `supabase://${WEDDING_MEDIA_BUCKET}/`
const SIGNED_URL_TTL_SECONDS = 60 * 60

let cachedClient: SupabaseClient | null | undefined

function storageClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return cachedClient
}

export function weddingMediaStorageConfigured(): boolean {
  return storageClient() !== null
}

export function isPrivateWeddingMediaUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(STORAGE_URI_PREFIX))
}

function storagePathFromUri(value: string): string | null {
  if (!value.startsWith(STORAGE_URI_PREFIX)) return null
  const path = value.slice(STORAGE_URI_PREFIX.length)
  return path || null
}

export async function uploadPrivateWeddingMedia({
  weddingId,
  type,
  filename,
  bytes,
  contentType,
}: {
  weddingId: string
  type: 'photo' | 'video'
  filename: string
  bytes: ArrayBuffer
  contentType: string
}): Promise<string> {
  const client = storageClient()
  if (!client) throw new Error('Supabase Storage is not configured.')

  const directory = type === 'photo' ? 'photos' : 'videos'
  const objectPath = `${weddingId}/${directory}/${filename}`
  const { data, error } = await client.storage
    .from(WEDDING_MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    })

  if (error || !data?.path) {
    throw new Error(error?.message || 'Supabase Storage upload failed.')
  }

  return `${STORAGE_URI_PREFIX}${data.path}`
}

export async function resolvePrivateWeddingMediaUrl(
  storedUrl: string | null | undefined,
): Promise<string | null> {
  if (!storedUrl) return null
  const objectPath = storagePathFromUri(storedUrl)
  if (!objectPath) return storedUrl

  const client = storageClient()
  if (!client) return null

  const { data, error } = await client.storage
    .from(WEDDING_MEDIA_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function resolvePrivateWeddingMediaUrls<T extends {
  url: string
  thumbnailUrl?: string | null
}>(items: T[]): Promise<Array<T & { url: string; thumbnailUrl?: string | null }>> {
  return Promise.all(
    items.map(async (item) => {
      const [url, thumbnailUrl] = await Promise.all([
        resolvePrivateWeddingMediaUrl(item.url),
        item.thumbnailUrl ? resolvePrivateWeddingMediaUrl(item.thumbnailUrl) : Promise.resolve(null),
      ])

      return {
        ...item,
        url: url || item.url,
        thumbnailUrl: item.thumbnailUrl ? thumbnailUrl || item.thumbnailUrl : item.thumbnailUrl,
      }
    }),
  )
}
