import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/* ============================================================
   /api/auth/signup
   ------------------------------------------------------------
   Creates a new Supabase Auth user AND a matching UserProfile
   row in our database. The UserProfile mirrors the Supabase
   auth.users record so we can join it to wewed data (comments,
   media, messages) without cross-database queries.

   Body: { email, password, displayName? }
   Returns: { success, user } or { success: false, error }
   ============================================================ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()
    const password = body.password
    const displayName = body.displayName?.trim()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // 1. Create the auth user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
      },
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    // 2. If signup succeeded, create a UserProfile row in our DB
    //    (mirrors the Supabase auth.users record)
    if (data.user) {
      try {
        await db.userProfile.create({
          data: {
            id: data.user.id, // matches Supabase auth.users.id
            email,
            displayName: displayName || null,
          },
        })
      } catch (profileErr) {
        // If the profile creation fails (e.g. race condition / duplicate),
        // we don't want to fail the whole signup — the auth user exists.
        // Log it and continue.
        console.error('[auth/signup] UserProfile creation failed:', profileErr)
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
      // Supabase may require email confirmation before the session is active.
      // If email confirmation is enabled, `data.session` will be null and
      // the user needs to click the link in the confirmation email.
      needsConfirmation: !data.session,
    })
  } catch (err) {
    console.error('[auth/signup] Error:', err)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during signup.' },
      { status: 500 }
    )
  }
}
