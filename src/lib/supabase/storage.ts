import { createServerClient } from '@/lib/supabase/server'

/**
 * Supabase Storage helper for media uploads.
 *
 * Uploads files to the `wedding-media` bucket in Supabase Storage.
 * Returns the public URL for the uploaded file.
 *
 * If Supabase env vars are not configured, returns null (caller should
 * fall back to local filesystem storage).
 *
 * Bucket setup (run once in Supabase dashboard):
 *  1. Go to Storage → New bucket
 *  2. Name: wedding-media
 *  3. Public: YES (so photos are publicly viewable)
 *  4. File size limit: 10 MB
 *  5. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm
 */

const BUCKET_NAME = 'wedding-media'

/**
 * Upload a file to Supabase Storage.
 *
 * @param file The File/Blob to upload
 * @param path The storage path (e.g. "charity-and-kudzie/photos/uuid.jpg")
 * @returns The public URL, or null if upload failed / Supabase not configured
 */
export async function uploadToSupabaseStorage(
  file: File | Buffer,
  path: string
): Promise<string | null> {
  try {
    const supabase = await createServerClient()

    const arrayBuffer =
      file instanceof File ? await file.arrayBuffer() : file.buffer

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, arrayBuffer, {
        contentType: file instanceof File ? file.type : 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      console.error('[supabase-storage] Upload error:', error.message)
      return null
    }

    // Get the public URL
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    return data.publicUrl
  } catch (err) {
    console.error('[supabase-storage] Error:', err)
    return null
  }
}

/**
 * Check if Supabase Storage is configured (env vars present).
 * Used by the media upload route to decide between Supabase and local FS.
 */
export function isSupabaseStorageConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Build a storage path for a wedding media file.
 * Format: {slug}/{type}/{uuid}.{ext}
 * Example: charity-and-kudzie/photos/abc123.jpg
 */
export function buildMediaPath(
  weddingSlug: string,
  type: string,
  filename: string
): string {
  const folder = type === 'video' ? 'videos' : 'photos'
  return `${weddingSlug}/${folder}/${filename}`
}
