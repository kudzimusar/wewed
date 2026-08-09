import 'server-only'

import { NextResponse } from 'next/server'
import { CommunicationError } from '@/lib/communications'

export function communicationJson(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export function communicationErrorResponse(error: unknown): NextResponse {
  if (error instanceof CommunicationError) {
    return communicationJson(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  if (error instanceof Error) {
    if (
      error.message.includes('characters or fewer') ||
      error.message.includes('at most')
    ) {
      return communicationJson(
        { success: false, error: error.message },
        { status: 400 },
      )
    }
  }

  console.error('[COMMUNICATIONS] Unexpected error:', error)
  return communicationJson(
    { success: false, error: 'Communication request failed.' },
    { status: 500 },
  )
}
