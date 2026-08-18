import { NextRequest, NextResponse } from 'next/server'
import { Phase3ContractError, recordContractDecision } from '@/lib/contracts/phase3'

function sourceChannel(request: NextRequest): 'WEB' | 'MOBILE_WEB' {
  const agent = request.headers.get('user-agent') || ''
  return /android|iphone|ipad|mobile/i.test(agent) ? 'MOBILE_WEB' : 'WEB'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const data = await recordContractDecision({
      token,
      decision: body?.decision,
      identityName: body?.identityName,
      identityEmail: body?.identityEmail,
      declarationAccepted: body?.declarationAccepted === true,
      reason: body?.reason,
      userAgent: request.headers.get('user-agent'),
      ipAddress: forwarded,
      sourceChannel: sourceChannel(request),
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase3ContractError) {
      return NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status })
    }
    console.error('[PHASE3 CONTRACT DECISION] error:', error)
    return NextResponse.json({ success: false, error: 'Wewed could not record this governed contract decision.' }, { status: 500 })
  }
}
