import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/* ============================================================
   /api/auth/me
   ------------------------------------------------------------
   Returns the current authenticated user's profile, or null.
   Called by client components to check auth state on mount.

   Returns: { success, user: { id, email, displayName, avatarUrl, role, coupleId } | null }
   ============================================================ */

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: true, user: null })
    }

    // Fetch the wewed UserProfile (may not exist if user signed up
    // before this feature was deployed — create it as a fallback).
    let profile = await db.userProfile.findUnique({
      where: { id: user.id },
    })

    if (!profile) {
      try {
        profile = await db.userProfile.create({
          data: {
            id: user.id,
            email: user.email ?? '',
            displayName: (user.user_metadata?.display_name as string) || null,
            lastLoginAt: new Date(),
          },
        })
      } catch {
        // If creation fails (race condition), return minimal info
        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            displayName: null,
            avatarUrl: null,
            role: 'viewer',
            coupleId: null,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        coupleId: profile.coupleId,
      },
    })
  } catch (err) {
    console.error('[auth/me] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user.' },
      { status: 500 }
    )
  }
}
