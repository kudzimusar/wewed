import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase server client.
 *
 * Used in Server Components, Route Handlers, and Server Actions for:
 *  - Reading the current user's session (getUser)
 *  - Server-side auth checks (protecting admin routes)
 *  - Performing privileged DB operations on behalf of an authenticated user
 *
 * Unlike the browser client, this one reads the Supabase session from the
 * request cookies (set by the browser client during signIn). Each request
 * gets its own client instance.
 *
 * Environment variables:
 *  NEXT_PUBLIC_SUPABASE_URL
 *  NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

export async function createServerClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      '[wewed] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Set these in your .env file. See SUPABASE_SETUP.md for instructions.'
    )
  }

  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

/**
 * Get the current authenticated user (server-side).
 * Returns null if not logged in.
 *
 * Usage in Server Components:
 *   const user = await getCurrentUser()
 *   if (!user) redirect('/login')
 */
export async function getCurrentUser() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}
