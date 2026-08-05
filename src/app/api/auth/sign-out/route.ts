import { NextResponse } from 'next/server'
import { clearAppSessionCookie } from '@/lib/app-session'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const response = NextResponse.json({ success: true, authorized: false })
  clearAppSessionCookie(response)

  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[auth/sign-out] Supabase sign-out failed:', error)
  }

  return response
}
