import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { mapsToWeddingField, syncWeddingField } from '@/lib/content/wedding-fields'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_STATUSES,
  SITE_ITEM_KINDS,
  isPublicScalarField,
  isSiteItemKind,
  isSiteSectionKey,
  resolveSections,
  parseSectionSettings,
  type AnnouncementAudience,
  type AnnouncementStatus,
  type EditorAnnouncement,
  type EditorSiteItem,
  type PublicAnnouncement,
  type PublicSiteItem,
  type PublicSiteStructure,
  type SiteItemKind,
  type SiteSectionKey,
} from '@/lib/wedding-site/model'

/**
 * QRO07-SHIP01 — wedding-website authority (server). Every read and write here is scoped by an
 * explicit weddingId that the CALLER has already authorized; nothing trusts a client-supplied
 * wedding identity.
 */

export class SiteConflictError extends Error {
  constructor(readonly current: unknown) {
    super('SITE_CONFLICT')
    this.name = 'SiteConflictError'
  }
}

export class SiteValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteValidationError'
  }
}

type Tx = Prisma.TransactionClient

const MAX_TITLE = 200
const MAX_BODY = 8_000
const MAX_URL = 2_048
const MAX_SCALAR = 20_000

function text(value: unknown, max: number, field: string, required = false): string | null {
  if (value == null) {
    if (required) throw new SiteValidationError(`${field} is required.`)
    return null
  }
  if (typeof value !== 'string') throw new SiteValidationError(`${field} must be text.`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new SiteValidationError(`${field} is required.`)
  if (trimmed.length > max) throw new SiteValidationError(`${field} is too long.`)
  return trimmed || null
}

function url(value: unknown, field: string): string | null {
  const raw = text(value, MAX_URL, field)
  if (!raw) return null
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
    return parsed.toString()
  } catch {
    throw new SiteValidationError(`${field} must be a web address.`)
  }
}

function metadataObject(value: unknown): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new SiteValidationError('metadata must be an object.')
  const json = JSON.stringify(value)
  if (json.length > 16_000) throw new SiteValidationError('metadata is too large.')
  return JSON.parse(json) as Record<string, unknown>
}

// ─── Reads ────────────────────────────────────────────────────────────────────────────────────

const itemSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  url: true,
  metadata: true,
  order: true,
  enabled: true,
  updatedAt: true,
  section: { select: { key: true } },
  media: { select: { id: true, url: true, thumbnailUrl: true, caption: true, weddingId: true } },
} as const

type ItemRow = Prisma.WeddingSiteItemGetPayload<{ select: typeof itemSelect }>

function toPublicItem(row: ItemRow, weddingId: string): PublicSiteItem {
  return {
    id: row.id,
    kind: row.kind as SiteItemKind,
    title: row.title,
    body: row.body,
    url: row.url,
    // A media link from another wedding is never followed.
    media: row.media && row.media.weddingId === weddingId
      ? { id: row.media.id, url: row.media.url, thumbnailUrl: row.media.thumbnailUrl, caption: row.media.caption }
      : null,
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {},
    order: row.order,
  }
}

export async function loadPublicSiteStructure(weddingId: string, client: Pick<typeof db, 'weddingSiteSection' | 'weddingSiteItem'> = db): Promise<PublicSiteStructure> {
  const [sectionRows, itemRows] = await Promise.all([
    client.weddingSiteSection.findMany({
      where: { weddingId },
      select: { key: true, enabled: true, order: true, layoutVariant: true, settings: true },
    }),
    client.weddingSiteItem.findMany({
      where: { weddingId, enabled: true, section: { weddingId, enabled: true } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: itemSelect,
    }),
  ])
  const sections = resolveSections(sectionRows)
  const items: PublicSiteStructure['items'] = {}
  for (const row of itemRows) {
    const key = row.section.key
    if (!isSiteSectionKey(key) || !isSiteItemKind(row.kind)) continue
    ;(items[key] ??= []).push(toPublicItem(row, weddingId))
  }
  return { sections, items }
}

function announcementIsLive(row: { status: string; publishedAt: Date | null; expiresAt: Date | null }, now: Date): boolean {
  return (
    row.status === 'published' &&
    row.publishedAt != null &&
    row.publishedAt.getTime() <= now.getTime() &&
    (row.expiresAt == null || row.expiresAt.getTime() > now.getTime())
  )
}

/**
 * The one published-announcement projection read by the web wedding site, the web/PWA Wedding Day,
 * and the iOS/Android Wedding Day. `attending` announcements reach only attending Guests and the
 * wedding team; nothing is ever fabricated when there are none.
 */
export async function loadPublishedAnnouncements(
  weddingId: string,
  options: { includeAttendingOnly: boolean; now?: Date },
  client: Pick<typeof db, 'weddingAnnouncement'> = db,
): Promise<PublicAnnouncement[]> {
  const now = options.now ?? new Date()
  const rows = await client.weddingAnnouncement.findMany({
    where: {
      weddingId,
      status: 'published',
      audience: options.includeAttendingOnly ? { in: [...ANNOUNCEMENT_AUDIENCES] } : 'guests',
    },
    orderBy: [{ order: 'asc' }, { publishedAt: 'desc' }],
  })
  return rows
    .filter((row) => announcementIsLive(row, now))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      order: row.order,
    }))
}

import type { EditorSiteProjection, CoreFacts } from '@/lib/wedding-site/model'
export type { EditorSiteProjection, CoreFacts }

export async function loadEditorSite(weddingId: string): Promise<EditorSiteProjection> {
  const [wedding, sectionRows, itemRows, announcementRows, scalarRows, draftRows, mediaRows] = await Promise.all([
    db.wedding.findUniqueOrThrow({
      where: { id: weddingId },
      select: {
        date: true, venue: true, venueCity: true, venueCountry: true, venueMapUrl: true, tagline: true,
        monogram: true, updatedAt: true,
        couple: { select: { partner1: true, partner2: true, updatedAt: true } },
      },
    }),
    db.weddingSiteSection.findMany({ where: { weddingId }, select: { key: true, enabled: true, order: true, layoutVariant: true, settings: true } }),
    db.weddingSiteItem.findMany({ where: { weddingId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: itemSelect }),
    db.weddingAnnouncement.findMany({ where: { weddingId }, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] }),
    db.weddingContent.findMany({ where: { weddingId }, select: { section: true, field: true, value: true, updatedAt: true } }),
    db.contentRevision.findMany({
      where: { weddingId, status: 'draft' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, section: true, fieldKey: true, value: true, updatedAt: true },
    }),
    db.mediaItem.findMany({
      where: { weddingId, type: 'photo' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, url: true, thumbnailUrl: true, caption: true, type: true },
    }),
  ])
  const seenDraft = new Set<string>()
  return {
    sections: resolveSections(sectionRows),
    items: itemRows
      .filter((row) => isSiteSectionKey(row.section.key) && isSiteItemKind(row.kind))
      .map((row) => ({
        ...toPublicItem(row, weddingId),
        sectionKey: row.section.key as SiteSectionKey,
        enabled: row.enabled,
        updatedAt: row.updatedAt.toISOString(),
      })),
    announcements: announcementRows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      order: row.order,
      status: row.status as AnnouncementStatus,
      audience: row.audience as AnnouncementAudience,
      updatedAt: row.updatedAt.toISOString(),
    })),
    scalars: scalarRows
      .filter((row) => isPublicScalarField(row.section, row.field))
      .map((row) => ({ section: row.section, field: row.field, value: row.value, updatedAt: row.updatedAt.toISOString() })),
    drafts: draftRows
      .filter((row) => isPublicScalarField(row.section, row.fieldKey))
      .filter((row) => {
        const key = `${row.section}.${row.fieldKey}`
        if (seenDraft.has(key)) return false
        seenDraft.add(key)
        return true
      })
      .map((row) => ({ id: row.id, section: row.section, field: row.fieldKey, value: row.value, updatedAt: row.updatedAt.toISOString() })),
    core: {
      partner1: wedding.couple.partner1,
      partner2: wedding.couple.partner2,
      date: wedding.date.toISOString(),
      venue: wedding.venue,
      venueCity: wedding.venueCity,
      venueCountry: wedding.venueCountry,
      venueMapUrl: wedding.venueMapUrl,
      tagline: wedding.tagline,
      monogram: wedding.monogram,
      weddingUpdatedAt: wedding.updatedAt.toISOString(),
      coupleUpdatedAt: wedding.couple.updatedAt.toISOString(),
    },
    media: mediaRows,
  }
}

// ─── Sections ─────────────────────────────────────────────────────────────────────────────────

async function ensureSection(tx: Tx, weddingId: string, key: SiteSectionKey) {
  const existing = await tx.weddingSiteSection.findUnique({ where: { weddingId_key: { weddingId, key } } })
  if (existing) return existing
  const defaults = resolveSections([]).find((section) => section.key === key)!
  return tx.weddingSiteSection.create({ data: { weddingId, key, enabled: defaults.enabled, order: defaults.order } })
}

export async function updateSections(
  weddingId: string,
  updates: Array<{ key: unknown; enabled?: unknown; order?: unknown; layoutVariant?: unknown; settings?: unknown }>,
) {
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 40) {
    throw new SiteValidationError('sections must be a non-empty list.')
  }
  return db.$transaction(async (tx) => {
    for (const update of updates) {
      if (!isSiteSectionKey(update.key)) throw new SiteValidationError('Unknown section.')
      const section = await ensureSection(tx, weddingId, update.key)
      const data: Prisma.WeddingSiteSectionUpdateInput = {}
      if (update.enabled !== undefined) {
        if (typeof update.enabled !== 'boolean') throw new SiteValidationError('enabled must be true or false.')
        data.enabled = update.enabled
      }
      if (update.order !== undefined) {
        if (!Number.isInteger(update.order)) throw new SiteValidationError('order must be a whole number.')
        data.order = update.order as number
      }
      if (update.layoutVariant !== undefined) data.layoutVariant = text(update.layoutVariant, 40, 'layoutVariant')
      if (update.settings !== undefined) {
        const raw = update.settings as Record<string, unknown> | null
        if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw new SiteValidationError('settings must be an object.')
        if (raw && raw.showProgramme !== undefined && typeof raw.showProgramme !== 'boolean') throw new SiteValidationError('showProgramme must be true or false.')
        data.settings = raw ? (parseSectionSettings(raw) as Prisma.InputJsonValue) : Prisma.DbNull
      }
      await tx.weddingSiteSection.update({ where: { id: section.id }, data })
    }
    const rows = await tx.weddingSiteSection.findMany({
      where: { weddingId },
      select: { key: true, enabled: true, order: true, layoutVariant: true, settings: true },
    })
    return resolveSections(rows)
  })
}

// ─── Items ────────────────────────────────────────────────────────────────────────────────────

async function assertMediaBelongs(tx: Tx, weddingId: string, mediaId: unknown): Promise<string | null> {
  if (mediaId == null || mediaId === '') return null
  if (typeof mediaId !== 'string') throw new SiteValidationError('mediaId must be text.')
  const media = await tx.mediaItem.findFirst({ where: { id: mediaId, weddingId }, select: { id: true } })
  if (!media) throw new SiteValidationError('That photo does not belong to this wedding.')
  return media.id
}

export async function createItem(
  weddingId: string,
  input: { kind: unknown; title: unknown; body?: unknown; url?: unknown; mediaId?: unknown; metadata?: unknown; enabled?: unknown },
): Promise<EditorSiteItem> {
  if (!isSiteItemKind(input.kind)) throw new SiteValidationError('Unknown item type.')
  const kind = input.kind
  const sectionKey = SITE_ITEM_KINDS[kind]
  const row = await db.$transaction(async (tx) => {
    const section = await ensureSection(tx, weddingId, sectionKey)
    const last = await tx.weddingSiteItem.findFirst({ where: { weddingId, sectionId: section.id }, orderBy: { order: 'desc' }, select: { order: true } })
    return tx.weddingSiteItem.create({
      data: {
        weddingId,
        sectionId: section.id,
        kind,
        title: text(input.title, MAX_TITLE, 'title', true)!,
        body: text(input.body, MAX_BODY, 'body'),
        url: url(input.url, 'url'),
        mediaId: await assertMediaBelongs(tx, weddingId, input.mediaId),
        metadata: metadataObject(input.metadata) as Prisma.InputJsonValue,
        order: (last?.order ?? -1) + 1,
        enabled: input.enabled === true,
      },
      select: itemSelect,
    })
  })
  return { ...toPublicItem(row, weddingId), sectionKey, enabled: row.enabled, updatedAt: row.updatedAt.toISOString() }
}

export async function updateItem(
  weddingId: string,
  itemId: string,
  input: { expectedUpdatedAt?: unknown; title?: unknown; body?: unknown; url?: unknown; mediaId?: unknown; metadata?: unknown; enabled?: unknown },
): Promise<EditorSiteItem> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.weddingSiteItem.findFirst({ where: { id: itemId, weddingId }, select: itemSelect })
    if (!current) throw new SiteValidationError('Item not found.')
    if (typeof input.expectedUpdatedAt === 'string' && input.expectedUpdatedAt !== current.updatedAt.toISOString()) {
      throw new SiteConflictError(toPublicItem(current, weddingId))
    }
    const data: Prisma.WeddingSiteItemUpdateInput = {}
    if (input.title !== undefined) data.title = text(input.title, MAX_TITLE, 'title', true)!
    if (input.body !== undefined) data.body = text(input.body, MAX_BODY, 'body')
    if (input.url !== undefined) data.url = url(input.url, 'url')
    if (input.metadata !== undefined) data.metadata = metadataObject(input.metadata) as Prisma.InputJsonValue
    if (input.mediaId !== undefined) {
      const mediaId = await assertMediaBelongs(tx, weddingId, input.mediaId)
      data.media = mediaId ? { connect: { id: mediaId } } : { disconnect: true }
    }
    if (input.enabled !== undefined) {
      if (typeof input.enabled !== 'boolean') throw new SiteValidationError('enabled must be true or false.')
      data.enabled = input.enabled
    }
    return tx.weddingSiteItem.update({ where: { id: current.id }, data, select: itemSelect })
  })
  return {
    ...toPublicItem(row, weddingId),
    sectionKey: row.section.key as SiteSectionKey,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function deleteItem(weddingId: string, itemId: string): Promise<void> {
  const result = await db.weddingSiteItem.deleteMany({ where: { id: itemId, weddingId } })
  if (result.count === 0) throw new SiteValidationError('Item not found.')
}

/** Reorder the items of ONE section; ids must be exactly that section's items for this wedding. */
export async function reorderItems(weddingId: string, sectionKey: unknown, orderedIds: unknown): Promise<void> {
  if (!isSiteSectionKey(sectionKey)) throw new SiteValidationError('Unknown section.')
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    throw new SiteValidationError('ids must be a list.')
  }
  await db.$transaction(async (tx) => {
    const items = await tx.weddingSiteItem.findMany({ where: { weddingId, section: { key: sectionKey } }, select: { id: true } })
    const current = new Set(items.map((item) => item.id))
    if (current.size !== orderedIds.length || !orderedIds.every((id) => current.has(id as string))) {
      throw new SiteValidationError('The list does not match this section. Refresh and try again.')
    }
    for (const [index, id] of (orderedIds as string[]).entries()) {
      await tx.weddingSiteItem.update({ where: { id }, data: { order: index } })
    }
  })
}

// ─── Announcements ────────────────────────────────────────────────────────────────────────────

function announcementFields(input: Record<string, unknown>, partial: boolean) {
  const data: Prisma.WeddingAnnouncementUncheckedUpdateInput = {}
  if (!partial || input.title !== undefined) data.title = text(input.title, MAX_TITLE, 'title', true)!
  if (!partial || input.body !== undefined) data.body = text(input.body, MAX_BODY, 'body', true)!
  if (input.audience !== undefined) {
    if (!(ANNOUNCEMENT_AUDIENCES as readonly unknown[]).includes(input.audience)) throw new SiteValidationError('Unknown audience.')
    data.audience = input.audience as string
  }
  if (input.expiresAt !== undefined) {
    if (input.expiresAt === null || input.expiresAt === '') data.expiresAt = null
    else {
      const date = new Date(String(input.expiresAt))
      if (Number.isNaN(date.getTime())) throw new SiteValidationError('expiresAt must be a date.')
      data.expiresAt = date
    }
  }
  if (input.order !== undefined) {
    if (!Number.isInteger(input.order)) throw new SiteValidationError('order must be a whole number.')
    data.order = input.order as number
  }
  return data
}

function editorAnnouncement(row: Prisma.WeddingAnnouncementGetPayload<object>): EditorAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    order: row.order,
    status: row.status as AnnouncementStatus,
    audience: row.audience as AnnouncementAudience,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createAnnouncement(weddingId: string, input: Record<string, unknown>): Promise<EditorAnnouncement> {
  const data = announcementFields(input, false)
  const publish = input.status === 'published'
  const row = await db.weddingAnnouncement.create({
    data: {
      weddingId,
      title: data.title as string,
      body: data.body as string,
      audience: (data.audience as string | undefined) ?? 'guests',
      expiresAt: (data.expiresAt as Date | null | undefined) ?? null,
      order: (data.order as number | undefined) ?? 0,
      status: publish ? 'published' : 'draft',
      publishedAt: publish ? new Date() : null,
    },
  })
  return editorAnnouncement(row)
}

export async function updateAnnouncement(weddingId: string, id: string, input: Record<string, unknown>): Promise<EditorAnnouncement> {
  return db.$transaction(async (tx) => {
    const current = await tx.weddingAnnouncement.findFirst({ where: { id, weddingId } })
    if (!current) throw new SiteValidationError('Announcement not found.')
    if (typeof input.expectedUpdatedAt === 'string' && input.expectedUpdatedAt !== current.updatedAt.toISOString()) {
      throw new SiteConflictError(editorAnnouncement(current))
    }
    const data = announcementFields(input, true)
    if (input.status !== undefined) {
      if (!(ANNOUNCEMENT_STATUSES as readonly unknown[]).includes(input.status)) throw new SiteValidationError('Unknown status.')
      data.status = input.status as string
      if (input.status === 'published' && current.status !== 'published') data.publishedAt = new Date()
    }
    return editorAnnouncement(await tx.weddingAnnouncement.update({ where: { id: current.id }, data }))
  })
}

export async function deleteAnnouncement(weddingId: string, id: string): Promise<void> {
  const result = await db.weddingAnnouncement.deleteMany({ where: { id, weddingId } })
  if (result.count === 0) throw new SiteValidationError('Announcement not found.')
}

// ─── Site copy lifecycle: draft → publish → materialize ───────────────────────────────────────

function assertScalar(section: unknown, field: unknown): { section: string; field: string } {
  if (typeof section !== 'string' || typeof field !== 'string' || !isPublicScalarField(section, field)) {
    throw new SiteValidationError('That field is not editable site copy.')
  }
  return { section, field }
}

/** Save an unpublished draft. Guests never see drafts. */
export async function saveScalarDraft(weddingId: string, authorId: string | null, sectionIn: unknown, fieldIn: unknown, valueIn: unknown) {
  const { section, field } = assertScalar(sectionIn, fieldIn)
  const value = typeof valueIn === 'string' ? valueIn : ''
  if (value.length > MAX_SCALAR) throw new SiteValidationError('That text is too long.')
  return db.$transaction(async (tx) => {
    const published = await tx.weddingContent.findUnique({ where: { weddingId_section_field: { weddingId, section, field } } })
    const existing = await tx.contentRevision.findFirst({ where: { weddingId, section, fieldKey: field, status: 'draft' }, orderBy: { updatedAt: 'desc' } })
    return existing
      ? tx.contentRevision.update({ where: { id: existing.id }, data: { value, authorId, previousValue: published?.value ?? null } })
      : tx.contentRevision.create({ data: { weddingId, section, fieldKey: field, value, status: 'draft', authorId, previousValue: published?.value ?? null } })
  })
}

/**
 * Publish site copy. In ONE transaction: record a published ContentRevision, archive older
 * published and draft revisions for the field, and materialize the value into WeddingContent — the
 * row loadWeddingDataBySlug and /api/wedding-content serve. `expectedUpdatedAt` is the version the
 * editor started from (null = "there was no published value"); a mismatch is a conflict.
 * An empty value unpublishes (the section then hides for Guests).
 */
export async function publishScalar(
  weddingId: string,
  authorId: string | null,
  sectionIn: unknown,
  fieldIn: unknown,
  valueIn: unknown,
  expectedUpdatedAt: unknown,
) {
  const { section, field } = assertScalar(sectionIn, fieldIn)
  const value = typeof valueIn === 'string' ? valueIn.trim() : ''
  if (value.length > MAX_SCALAR) throw new SiteValidationError('That text is too long.')
  return db.$transaction(async (tx) => {
    const where = { weddingId_section_field: { weddingId, section, field } }
    const current = await tx.weddingContent.findUnique({ where })
    if (expectedUpdatedAt !== undefined) {
      const currentStamp = current?.updatedAt.toISOString() ?? null
      if ((expectedUpdatedAt ?? null) !== currentStamp) throw new SiteConflictError({ value: current?.value ?? null, updatedAt: currentStamp })
    }
    await tx.contentRevision.updateMany({
      where: { weddingId, section, fieldKey: field, status: { in: ['published', 'draft'] } },
      data: { status: 'archived' },
    })
    await tx.contentRevision.create({
      data: { weddingId, section, fieldKey: field, value, status: 'published', publishedAt: new Date(), authorId, previousValue: current?.value ?? null },
    })
    if (!value) {
      if (current) await tx.weddingContent.delete({ where })
      return { value: null, updatedAt: null }
    }
    const row = await tx.weddingContent.upsert({ where, create: { weddingId, section, field, value }, update: { value } })
    return { value: row.value, updatedAt: row.updatedAt.toISOString() }
  })
}

/**
 * Take published site copy off the public site WITHOUT losing it: the value is kept as a draft
 * revision the couple can publish again, and the materialized row is removed.
 */
export async function unpublishScalar(weddingId: string, authorId: string | null, sectionIn: unknown, fieldIn: unknown) {
  const { section, field } = assertScalar(sectionIn, fieldIn)
  return db.$transaction(async (tx) => {
    const where = { weddingId_section_field: { weddingId, section, field } }
    const current = await tx.weddingContent.findUnique({ where })
    if (!current) return { unpublished: false }
    await tx.contentRevision.updateMany({ where: { weddingId, section, fieldKey: field, status: 'published' }, data: { status: 'archived' } })
    await tx.contentRevision.create({ data: { weddingId, section, fieldKey: field, value: current.value, status: 'draft', authorId, previousValue: null } })
    await tx.weddingContent.delete({ where })
    return { unpublished: true }
  })
}

// ─── Core facts (single authority for web, iOS and Android) ───────────────────────────────────

export async function updateCoreFacts(weddingId: string, input: Record<string, unknown>): Promise<CoreFacts> {
  return db.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { coupleId: true, updatedAt: true, couple: { select: { updatedAt: true } } } })
    if (typeof input.expectedWeddingUpdatedAt === 'string' && input.expectedWeddingUpdatedAt !== wedding.updatedAt.toISOString()) {
      throw new SiteConflictError(null)
    }
    if (typeof input.expectedCoupleUpdatedAt === 'string' && input.expectedCoupleUpdatedAt !== wedding.couple.updatedAt.toISOString()) {
      throw new SiteConflictError(null)
    }
    const coupleData: Prisma.CoupleUpdateInput = {}
    if (input.partner1 !== undefined) coupleData.partner1 = text(input.partner1, 120, 'First partner', true)!
    if (input.partner2 !== undefined) coupleData.partner2 = text(input.partner2, 120, 'Second partner', true)!
    const weddingData: Prisma.WeddingUpdateInput = {}
    if (input.date !== undefined) {
      const date = new Date(String(input.date))
      if (Number.isNaN(date.getTime())) throw new SiteValidationError('Enter a valid wedding date.')
      weddingData.date = date
    }
    if (input.venue !== undefined) weddingData.venue = text(input.venue, 200, 'Venue', true)!
    if (input.venueCity !== undefined) weddingData.venueCity = text(input.venueCity, 120, 'City') ?? ''
    if (input.venueCountry !== undefined) weddingData.venueCountry = text(input.venueCountry, 120, 'Country') ?? ''
    if (input.venueMapUrl !== undefined) weddingData.venueMapUrl = url(input.venueMapUrl, 'Map link')
    if (input.tagline !== undefined) weddingData.tagline = text(input.tagline, 200, 'Tagline')
    if (input.monogram !== undefined) weddingData.monogram = text(input.monogram, 12, 'Monogram')
    if (Object.keys(coupleData).length) await tx.couple.update({ where: { id: wedding.coupleId }, data: coupleData })
    if (Object.keys(weddingData).length) await tx.wedding.update({ where: { id: weddingId }, data: weddingData })
    const next = await tx.wedding.findUniqueOrThrow({
      where: { id: weddingId },
      select: {
        date: true, venue: true, venueCity: true, venueCountry: true, venueMapUrl: true, tagline: true, monogram: true, updatedAt: true,
        couple: { select: { partner1: true, partner2: true, updatedAt: true } },
      },
    })
    return {
      partner1: next.couple.partner1,
      partner2: next.couple.partner2,
      date: next.date.toISOString(),
      venue: next.venue,
      venueCity: next.venueCity,
      venueCountry: next.venueCountry,
      venueMapUrl: next.venueMapUrl,
      tagline: next.tagline,
      monogram: next.monogram,
      weddingUpdatedAt: next.updatedAt.toISOString(),
      coupleUpdatedAt: next.couple.updatedAt.toISOString(),
    }
  })
}

// ─── Legacy backfill ──────────────────────────────────────────────────────────────────────────

const LEGACY_ORDERED: Array<{ section: string; prefix: RegExp; kind: SiteItemKind; map: (value: string, meta: Record<string, unknown>) => { title: string; body: string | null; metadata: Record<string, unknown> } }> = [
  { section: 'story', prefix: /^milestone-\d+$/, kind: 'story_milestone', map: (v, m) => ({ title: v, body: typeof m.body === 'string' ? m.body : null, metadata: pick(m, ['icon', 'year', 'date']) }) },
  { section: 'faq', prefix: /^item-\d+$/, kind: 'faq_item', map: (v, m) => ({ title: v, body: typeof m.answer === 'string' ? m.answer : null, metadata: {} }) },
  { section: 'travel', prefix: /^card-\d+$/, kind: 'travel_card', map: (v, m) => ({ title: v, body: typeof m.body === 'string' ? m.body : typeof m.description === 'string' ? m.description : null, metadata: m }) },
  { section: 'guests', prefix: /^party-\d+$/, kind: 'party_profile', map: (v, m) => ({ title: v, body: typeof m.bio === 'string' ? m.bio : null, metadata: omit(m, ['bio']) }) },
  { section: 'guests', prefix: /^guide-\d+$/, kind: 'guide_entry', map: (v, m) => ({ title: v, body: typeof m.content === 'string' ? m.content : null, metadata: {} }) },
  { section: 'venue', prefix: /^feature-\d+$/, kind: 'venue_feature', map: (v) => ({ title: v, body: null, metadata: {} }) },
  { section: 'venue', prefix: /^moment-\d+$/, kind: 'venue_moment', map: (v) => ({ title: v, body: null, metadata: {} }) },
  { section: 'registry', prefix: /^card-\d+$/, kind: 'registry_card', map: (v, m) => ({ title: v, body: typeof m.description === 'string' ? m.description : null, metadata: omit(m, ['description']) }) },
]

function pick(meta: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => meta[key] !== undefined).map((key) => [key, meta[key]]))
}
function omit(meta: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(meta).filter(([key]) => !keys.includes(key)))
}

/**
 * Copy legacy ordered WeddingContent rows into WeddingSiteItem as UNPUBLISHED items (enabled=false),
 * so nothing is lost and nothing unverified reaches Guests until the couple publishes it.
 * Idempotent: an item remembers its source row in metadata.legacySource.
 */
export async function backfillLegacySiteItems(weddingId: string): Promise<{ created: number }> {
  const rows = await db.weddingContent.findMany({ where: { weddingId }, orderBy: [{ order: 'asc' }] })
  let created = 0
  for (const spec of LEGACY_ORDERED) {
    const matches = rows
      .filter((row) => row.section === spec.section && spec.prefix.test(row.field) && row.value.trim())
      .sort((a, b) => (a.order === b.order ? a.field.localeCompare(b.field, undefined, { numeric: true }) : a.order - b.order))
    for (const [index, row] of matches.entries()) {
      const legacySource = `${row.section}.${row.field}`
      const exists = await db.weddingSiteItem.findFirst({
        where: { weddingId, kind: spec.kind, metadata: { path: ['legacySource'], equals: legacySource } },
        select: { id: true },
      })
      if (exists) continue
      let meta: Record<string, unknown> = {}
      try { meta = row.metadata ? JSON.parse(row.metadata) : {} } catch { meta = {} }
      const mapped = spec.map(row.value.trim(), meta && typeof meta === 'object' ? meta : {})
      await db.$transaction(async (tx) => {
        const section = await ensureSection(tx, weddingId, SITE_ITEM_KINDS[spec.kind])
        await tx.weddingSiteItem.create({
          data: {
            weddingId,
            sectionId: section.id,
            kind: spec.kind,
            title: mapped.title.slice(0, MAX_TITLE),
            body: mapped.body?.slice(0, MAX_BODY) ?? null,
            metadata: { ...mapped.metadata, legacySource } as Prisma.InputJsonValue,
            order: index,
            enabled: false,
          },
        })
      })
      created += 1
    }
  }
  return { created }
}

// ─── Revision publication effects (shared by /api/content*, restore and the site editor) ──────

/**
 * Everything that must happen, in the caller's transaction, when a ContentRevision becomes the
 * published version: older published revisions of the field are archived, a mapped Wedding column
 * is synced, and public site copy is materialized into WeddingContent (empty → removed). This is
 * what makes publishing and restoring change the same projection SSR, /api/wedding-content and
 * native readers use.
 */
export async function applyRevisionPublication(
  tx: Tx,
  revision: { id: string; weddingId: string; section: string; fieldKey: string; value: string },
): Promise<void> {
  await tx.contentRevision.updateMany({
    where: { weddingId: revision.weddingId, section: revision.section, fieldKey: revision.fieldKey, status: 'published', id: { not: revision.id } },
    data: { status: 'archived' },
  })
  if (mapsToWeddingField(revision.section, revision.fieldKey)) {
    await syncWeddingField(revision.weddingId, revision.section, revision.fieldKey, revision.value, tx)
  }
  if (isPublicScalarField(revision.section, revision.fieldKey)) {
    const where = { weddingId_section_field: { weddingId: revision.weddingId, section: revision.section, field: revision.fieldKey } }
    const value = revision.value.trim()
    if (value) await tx.weddingContent.upsert({ where, create: { weddingId: revision.weddingId, section: revision.section, field: revision.fieldKey, value }, update: { value } })
    else await tx.weddingContent.deleteMany({ where: { weddingId: revision.weddingId, section: revision.section, field: revision.fieldKey } })
  }
}

/** When the published revision of public site copy is withdrawn, the site stops showing it. */
export async function retractRevisionPublication(
  tx: Tx,
  revision: { id: string; weddingId: string; section: string; fieldKey: string },
): Promise<void> {
  if (!isPublicScalarField(revision.section, revision.fieldKey)) return
  const stillPublished = await tx.contentRevision.findFirst({
    where: { weddingId: revision.weddingId, section: revision.section, fieldKey: revision.fieldKey, status: 'published', id: { not: revision.id } },
    select: { id: true },
  })
  if (!stillPublished) {
    await tx.weddingContent.deleteMany({ where: { weddingId: revision.weddingId, section: revision.section, field: revision.fieldKey } })
  }
}
