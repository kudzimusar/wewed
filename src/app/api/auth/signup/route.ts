import { NextResponse } from 'next/server'

/**
 * Public self-service signup is intentionally disabled.
 *
 * Wewed is currently invite-only. Accounts are created or invited by an
 * administrator in Supabase, then assigned a role and couple in UserProfile.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Signup is invite-only. Ask a Wewed administrator for access.',
    },
    { status: 403 }
  )
}
