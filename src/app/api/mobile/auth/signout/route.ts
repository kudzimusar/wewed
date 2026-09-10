import { NextRequest, NextResponse } from 'next/server'
import { readBearerAppSession } from '@/lib/app-session'

export async function POST(request: NextRequest) {
  const session = readBearerAppSession(request)
  return NextResponse.json(
    {
      success: true,
      signedOut: Boolean(session),
      clearLocalSession: true,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
