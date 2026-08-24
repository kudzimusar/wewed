import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, resolveReferral } from '@/lib/booking-commerce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const referral = await resolveReferral(token)
    return NextResponse.redirect(new URL(referral.destination, request.nextUrl.origin), 307)
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.redirect(new URL('/vendors?referral=unavailable', request.nextUrl.origin), 307)
    }
    console.error('[REFERRAL REDIRECT] error:', error)
    return NextResponse.redirect(new URL('/vendors?referral=error', request.nextUrl.origin), 307)
  }
}
