import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/* ============================================================
   /api/auth/signin
   ------------------------------------------------------------
   Signs in a user via Supabase Auth (email + password).
   Also updates the UserProfile.lastLoginAt timestamp.

   Body: { email, password }
   Returns: { success, user } or { success: false, error }
   ============================================================ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      )
    }

    // Update lastLoginAt in our UserProfile table (fire-and-forget)
    if (data.user) {
      try {
        await db.userProfile.update({
          where: { id: data.user.id },
          data: { lastLoginAt: new Date() },
        })
      } catch {
        // Profile may not exist yet (e.g. user signed up before this feature)
        // Create it now as a fallback.
        try {
          await db.userProfile.create({
            data: {
              id: data.user.id,
              email,
              lastLoginAt: new Date(),
            },
          })
        } catch {
          // ignore — not critical for login
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
          }
        : null,
    })
  } catch (err) {
    console.error('[auth/signin] Error:', err)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during signin.' },
      { status: 500 }
    )
  }
}
