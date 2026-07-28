import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createServerClient } from '@/lib/supabase/server'

/* ============================================================
   /api/comments
   ------------------------------------------------------------
   Comments on photos, contributions, songs, sections.
   Requires authentication to POST; public to GET.

   GET  ?targetType=media&targetId=xxx&weddingSlug=charity-and-kudzie
        Returns: { success, comments: [...] }

   POST (authenticated)
        Body: { targetType, targetId, body, parentId? }
        Returns: { success, comment }
   ============================================================ */

const WEDDING_SLUG = 'charity-and-kudzie' // TODO: make dynamic per-couple

const VALID_TARGET_TYPES = new Set([
  'media',
  'contribution',
  'song',
  'section',
])

const MAX_COMMENT_LENGTH = 2000

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const targetType = request.nextUrl.searchParams.get('targetType')
    const targetId = request.nextUrl.searchParams.get('targetId')

    if (!targetType || !targetId) {
      return NextResponse.json(
        { success: false, error: 'targetType and targetId are required.' },
        { status: 400 }
      )
    }

    const wedding = await db.wedding.findFirst({
      where: { slug: WEDDING_SLUG },
      select: { id: true },
    })

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: 'Wedding not found.' },
        { status: 404 }
      )
    }

    const comments = await db.comment.findMany({
      where: {
        targetType,
        targetId,
        weddingId: wedding.id,
        status: 'published',
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        targetType: c.targetType,
        targetId: c.targetId,
        parentId: c.parentId,
        likeCount: c.likeCount,
        createdAt: c.createdAt.toISOString(),
        author: c.author
          ? {
              id: c.author.id,
              name: c.author.displayName || 'Guest',
              avatarUrl: c.author.avatarUrl,
            }
          : { id: null, name: 'Anonymous', avatarUrl: null },
      })),
    })
  } catch (err) {
    console.error('[comments GET] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments.' },
      { status: 500 }
    )
  }
}

// ─── POST (authenticated) ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication via Supabase
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be signed in to comment.' },
        { status: 401 }
      )
    }

    // 2. Ensure the user has a UserProfile
    let profile = await db.userProfile.findUnique({
      where: { id: user.id },
    })
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found. Please refresh and try again.' },
        { status: 403 }
      )
    }

    // 3. Check if user is banned
    if (profile.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account has been suspended.' },
        { status: 403 }
      )
    }

    // 4. Parse + validate the comment body
    const body = await request.json()
    const { targetType, targetId, body: commentBody, parentId } = body

    if (!targetType || !targetId || !commentBody) {
      return NextResponse.json(
        { success: false, error: 'targetType, targetId, and body are required.' },
        { status: 400 }
      )
    }

    if (!VALID_TARGET_TYPES.has(targetType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid targetType.' },
        { status: 400 }
      )
    }

    const trimmedBody = String(commentBody).trim()
    if (trimmedBody.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment cannot be empty.' },
        { status: 400 }
      )
    }

    if (trimmedBody.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).`,
        },
        { status: 400 }
      )
    }

    // 5. Find the wedding
    const wedding = await db.wedding.findFirst({
      where: { slug: WEDDING_SLUG },
      select: { id: true },
    })

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: 'Wedding not found.' },
        { status: 404 }
      )
    }

    // 6. If parentId is provided, verify the parent comment exists
    if (parentId) {
      const parent = await db.comment.findUnique({
        where: { id: parentId },
        select: { id: true, targetType: true, targetId: true },
      })
      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Parent comment not found.' },
          { status: 404 }
        )
      }
      if (parent.targetType !== targetType || parent.targetId !== targetId) {
        return NextResponse.json(
          { success: false, error: 'Parent comment does not match the target.' },
          { status: 400 }
        )
      }
    }

    // 7. Create the comment
    const comment = await db.comment.create({
      data: {
        body: trimmedBody,
        targetType,
        targetId,
        weddingId: wedding.id,
        authorId: profile.id,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        body: comment.body,
        targetType: comment.targetType,
        targetId: comment.targetId,
        parentId: comment.parentId,
        likeCount: comment.likeCount,
        createdAt: comment.createdAt.toISOString(),
        author: {
          id: comment.author.id,
          name: comment.author.displayName || 'Guest',
          avatarUrl: comment.author.avatarUrl,
        },
      },
    })
  } catch (err) {
    console.error('[comments POST] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to post comment.' },
      { status: 500 }
    )
  }
}
