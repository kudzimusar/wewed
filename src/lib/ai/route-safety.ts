import { NextRequest, NextResponse } from 'next/server'
import {
  PREVIEW_WRITE_BLOCK_MESSAGE,
  shouldBlockPreviewWrite,
} from '@/lib/preview-write-safety'

export function blockUnsafeAiPreviewWrite(
  request: NextRequest,
  weddingId: string,
): NextResponse | null {
  if (!shouldBlockPreviewWrite({ method: request.method, weddingId })) return null

  return NextResponse.json(
    {
      success: false,
      error: PREVIEW_WRITE_BLOCK_MESSAGE,
      code: 'PREVIEW_WRITE_BLOCKED',
    },
    { status: 409 },
  )
}
