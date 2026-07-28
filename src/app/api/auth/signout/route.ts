import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/* ============================================================
   /api/auth/signout
   ------------------------------------------------------------
   Signs out the current user by clearing the Supabase session.
   ============================================================ */

export async function POST() {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/signout] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to sign out.' },
      { status: 500 }
    )
  }
}
