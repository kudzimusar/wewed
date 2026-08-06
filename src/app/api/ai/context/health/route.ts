import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  GUEST_ACCESSIBLE_PRIVACY,
  PUBLIC_AI_CONTENT_SECTIONS,
} from '@/lib/ai/workspace-context'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim().slice(0, 160)
  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'Wedding slug is required.' },
      { status: 400 },
    )
  }

  try {
    const wedding = await db.wedding.findFirst({
      where: {
        slug,
        privacy: { in: [...GUEST_ACCESSIBLE_PRIVACY] },
      },
      select: {
        id: true,
        slug: true,
        privacy: true,
        lifecycle: true,
        _count: {
          select: {
            programmeItems: true,
          },
        },
      },
    })

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: 'Guest-accessible wedding was not found.' },
        { status: 404 },
      )
    }

    const [contentItems, publicDocumentChunks, privateDocumentChunks] =
      await Promise.all([
        db.weddingContent.count({
          where: {
            weddingId: wedding.id,
            section: { in: [...PUBLIC_AI_CONTENT_SECTIONS] },
          },
        }),
        db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM public."WeddingContent" c
          WHERE c."weddingId" = ${wedding.id}
            AND c.section = 'ai_document_chunk'
            AND COALESCE((c.value::jsonb ->> 'visibility'), 'private') = 'public'
        `,
        db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM public."WeddingContent" c
          WHERE c."weddingId" = ${wedding.id}
            AND c.section = 'ai_document_chunk'
            AND COALESCE((c.value::jsonb ->> 'visibility'), 'private') <> 'public'
        `,
      ])

    return NextResponse.json({
      success: true,
      slug: wedding.slug,
      privacy: wedding.privacy,
      lifecycle: wedding.lifecycle,
      grounding: {
        publishedContentItems: contentItems,
        programmeItems: wedding._count.programmeItems,
        publicDocumentChunks: Number(publicDocumentChunks[0]?.count ?? 0),
        privateDocumentChunksExcluded: Number(privateDocumentChunks[0]?.count ?? 0),
      },
      boundaries: {
        guestUsesPublishedWeddingData: true,
        guestUsesPrivatePlannerData: false,
        guestUsesOnlyPublicDocumentChunks: true,
      },
    })
  } catch (error) {
    console.error('[AI CONTEXT HEALTH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Wedding grounding diagnostics are unavailable.' },
      { status: 500 },
    )
  }
}
