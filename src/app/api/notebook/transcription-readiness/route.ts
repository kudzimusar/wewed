import { NextRequest, NextResponse } from 'next/server'
import { requireNotebookActor } from '@/lib/notebook/http'
import { resolveNotebookTranscriptionConfig } from '@/lib/notebook/transcription-config'

export async function GET(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error

  const config = resolveNotebookTranscriptionConfig()
  return NextResponse.json({
    success: true,
    data: {
      configured: Boolean(config),
      mode: !config ? 'none' : config.requestShape === 'zai' ? 'live-chunks' : 'direct',
      provider: config?.provider ?? null,
    },
  })
}
