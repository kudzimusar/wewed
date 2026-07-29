import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { clearAppSessionCookie } from '@/lib/app-session'

export async function POST() {
  const response = NextResponse.json({ success: true })

  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[auth/signout] Supabase signout failed:', error)
  }

  clearAppSessionCookie(response)
  return response
}
