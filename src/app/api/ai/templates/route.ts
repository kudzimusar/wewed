import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { blockUnsafeAiPreviewWrite } from '@/lib/ai/route-safety'
import {
  createReviewedAiTemplateVersion,
  reviewTemplateAnonymization,
} from '@/lib/ai/template-store'
import {
  AI_SECTIONS,
  createActionProposal,
  listAiTemplates,
  type AiTemplateVersionValue,
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
  const previewBlock = blockUnsafeAiPreviewWrite(
    request,
    access.context.weddingId,
  )
  if (previewBlock) return previewBlock

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action =
      typeof body.action === 'string' ? body.action : 'save_version'

    if (action === 'save_version') {
      const content = typeof body.content === 'string' ? body.content : ''
      const name = typeof body.name === 'string' ? body.name : ''
      const description =
        typeof body.description === 'string' ? body.description : ''
      if (!name.trim() || !content.trim()) {
        return NextResponse.json(
          { success: false, error: 'Template name and content are required.' },
          { status: 400 },
        )
      }
      if (body.anonymizationConfirmed !== true) {
        return NextResponse.json(
          {
            success: false,
            code: 'ANONYMIZATION_CONFIRMATION_REQUIRED',
            error:
              'Review the template for client-specific information and confirm anonymization before saving.',
          },
          { status: 409 },
        )
      }

      const review = await reviewTemplateAnonymization({
        weddingId: access.context.weddingId,
        name,
        description,
        content,
      })
      if (!review.safe) {
        return NextResponse.json(
          {
            success: false,
            code: 'ANONYMIZATION_REVIEW_FAILED',
            error:
              'Client-specific or sensitive information must be removed before this template can be saved as reusable.',
            findings: review.findings,
            reviewedTerms: review.reviewedTerms,
          },
          { status: 422 },
        )
      }

      const createdFrom =
        body.createdFrom === 'manual' ||
        body.createdFrom === 'completed_wedding'
          ? body.createdFrom
          : 'ai'
      const version = await createReviewedAiTemplateVersion({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        templateId:
          typeof body.templateId === 'string' && body.templateId.trim()
            ? body.templateId
            : undefined,
        name,
        description,
        content,
        createdFrom,
      })
      return NextResponse.json(
        {
          success: true,
          data: version,
          anonymizationReview: {
            passed: true,
            reviewedTerms: review.reviewedTerms,
          },
        },
        { status: 201 },
      )
    }

    if (action === 'propose_apply') {
      const versionId =
        typeof body.versionId === 'string' ? body.versionId.trim() : ''
      if (!versionId) {
        return NextResponse.json(
          { success: false, error: 'Template version id is required.' },
          { status: 400 },
        )
      }

      const row = await db.contentRevision.findFirst({
        where: {
          id: versionId,
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.template,
          status: { not: 'archived' },
        },
      })
      if (!row) {
        return NextResponse.json(
          { success: false, error: 'AI template version not found.' },
          { status: 404 },
        )
      }
      const template = JSON.parse(row.value) as AiTemplateVersionValue
      if (!template.anonymized) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Template must pass anonymization review before it can be proposed for application.',
          },
          { status: 409 },
        )
      }
      if (template.items.length < 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              'This template has no validated structured items. Add a JSON items block before proposing application.',
          },
          { status: 409 },
        )
      }

      const existing = await db.contentRevision.findFirst({
        where: {
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.proposal,
          status: { in: ['proposed', 'approved', 'executing'] },
          value: { contains: versionId },
        },
        select: { id: true, status: true },
      })
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `A template application proposal already exists in ${existing.status} state.`,
            proposalId: existing.id,
          },
          { status: 409 },
        )
      }

      const counts = template.items.reduce(
        (result, item) => {
          result[item.type] += 1
          return result
        },
        { task: 0, timeline: 0, reminder: 0 },
      )
      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type: 'apply_template',
        summary: `Apply ${template.name} v${template.version} (${template.items.length} validated items) to the active wedding.`,
        payload: { versionId: row.id },
        preview: {
          templateId: template.templateId,
          version: template.version,
          name: template.name,
          itemCount: template.items.length,
          counts,
          writes: ['tasks', 'timeline', 'reminders'],
          externalDelivery: false,
        },
      })
      return NextResponse.json({ success: true, data: proposal }, { status: 201 })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported template action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[AI TEMPLATES POST] error:', error)
    const message =
      error instanceof Error ? error.message : 'Unable to save AI template.'
    const status = message.includes('not found')
      ? 404
      : message.includes('Invalid') || message.includes('required')
        ? 400
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
