import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { buildTodayAttentionModel } from '@/lib/attention/today'

function serializeItem(item: Awaited<ReturnType<typeof buildTodayAttentionModel>>['today'][number]) {
  return { ...item, when: item.when.toISOString() }
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const model = await buildTodayAttentionModel(session)
    return NextResponse.json({
      success: true,
      data: {
        ...model,
        generatedAt: model.generatedAt.toISOString(),
        needsAction: model.needsAction.map(serializeItem),
        today: model.today.map(serializeItem),
        upcoming: model.upcoming.map(serializeItem),
      },
    })
  } catch (error) {
    console.error('[today GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to build Today view.' },
      { status: 500 },
    )
  }
}
