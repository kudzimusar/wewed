import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase browser client.
 *
 * Used in client components for:
 *  - Auth (signIn, signUp, signOut, onAuthStateChange)
 *  - Storage (upload photos from the browser directly to Supabase Storage,
 *    avoiding a round-trip through our Next.js API)
 *  - Realtime subscriptions (optional, for live features)
 *
 * The anon key is safe to expose to the browser — Supabase uses Row Level
 * Security (RLS) to enforce what each key can do. Write operations require
 * an authenticated user; public reads are allowed on published content.
 *
 * Environment variables (set in .env.local or your hosting dashboard):
 *  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 */

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // During build or before env vars are set, return a no-op client that
    // will throw clear errors if actually used. This prevents crashes during
    // SSR when env vars aren't available yet.
    if (typeof window !== 'undefined') {
      console.warn(
        '[wewed] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
          'Set these in your .env file. See SUPABASE_SETUP.md for instructions.'
      )
    }
  }

  return createBrowserClient(url ?? '', anonKey ?? '')
}
