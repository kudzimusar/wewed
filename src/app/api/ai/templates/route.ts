import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  createActionProposal,
  createAiTemplateVersion,
  listAiTemplates,
} from '@/lib/ai/workspace-store'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const data = await listAiTemplates(access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AI TEMPLATES GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load AI templates.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'save_version'

    if (action === 'save_version') {
      const content = typeof body.content === 'string' ? body.content : ''
      const name = typeof body.name === 'string' ? body.name : ''
      if (!name.trim() || !content.trim()) {
        return NextResponse.json(
          { success: false, error: 'Template name and content are required.' },
          { status: 400 },
        )
      }
      const version = await createAiTemplateVersion({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        templateId: typeof body.templateId === 'string' ? body.templateId : undefined,
        name,
        description: typeof body.description === 'string' ? body.description : undefined,
        content,
        anonymized: body.anonymized !== false,
        createdFrom:
          body.createdFrom === 'manual' || body.createdFrom === 'completed_wedding'
            ? body.createdFrom
            : 'ai',
      })
      return NextResponse.json({ success: true, data: version }, { status: 201 })
    }

    if (action === 'propose_apply') {
      const versionId = typeof body.versionId === 'string' ? body.versionId.trim() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : 'AI template'
      const itemCount = typeof body.itemCount === 'number' ? body.itemCount : 0
      if (!versionId) {
        return NextResponse.json(
          { success: false, error: 'Template version id is required.' },
          { status: 400 },
        )
      }
      if (itemCount < 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              'This template has no structured items. Add a JSON items block before proposing application.',
          },
          { status: 409 },
        )
      }
      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type: 'apply_template',
        summary: `Apply ${name} (${itemCount} structured items) to the active wedding.`,
        payload: { versionId },
        preview: { name, itemCount, writes: ['tasks', 'timeline', 'reminders'] },
      })
      return NextResponse.json({ success: true, data: proposal }, { status: 201 })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported template action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[AI TEMPLATES POST] error:', error)
    const message = error instanceof Error ? error.message : 'Unable to save AI template.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
