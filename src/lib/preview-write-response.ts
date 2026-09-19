import { NextResponse } from 'next/server'
import { PREVIEW_WRITE_BLOCK_MESSAGE, previewWeddingMutationBlocked } from './preview-write-safety'

export function previewWriteError(weddingId: string): NextResponse | null {
  if (!previewWeddingMutationBlocked(weddingId)) return null
  return NextResponse.json(
    { success: false, code: 'PREVIEW_WRITE_BLOCKED', error: PREVIEW_WRITE_BLOCK_MESSAGE },
    { status: 423, headers: { 'x-wewed-preview-write-blocked': 'true', 'Cache-Control': 'no-store' } },
  )
}
