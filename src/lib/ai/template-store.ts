import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  scanSensitiveTemplateContent,
  type SensitiveFinding,
} from '@/lib/ai/remediation'
import {
  AI_SECTIONS,
  extractTemplateItems,
  type AiTemplateVersionValue,
} from '@/lib/ai/workspace-store'

interface RevisionRow {
  id: string
  fieldKey: string
  value: string
  status: string
  weddingId: string
  authorId: string | null
  publishedAt: Date | null
  scheduledFor: Date | null
  createdAt: Date
  updatedAt: Date
}

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

function response(row: RevisionRow, value: AiTemplateVersionValue) {
  return {
    id: row.id,
    key: row.fieldKey,
    status: row.status,
    weddingId: row.weddingId,
    authorId: row.authorId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    value,
  }
}

export async function reviewTemplateAnonymization(input: {
  weddingId: string
  name: string
  description?: string
  content: string
}): Promise<{
  safe: boolean
  findings: SensitiveFinding[]
  reviewedTerms: number
}> {
  const [wedding, guests, vendors] = await Promise.all([
    db.wedding.findUnique({
      where: { id: input.weddingId },
      select: {
        title: true,
        tagline: true,
        venue: true,
        couple: {
          select: {
            partner1: true,
            partner2: true,
            surname: true,
          },
        },
      },
    }),
    db.guest.findMany({
      where: { weddingId: input.weddingId },
      select: { name: true },
      take: 500,
    }),
    db.vendor.findMany({
      where: { weddingId: input.weddingId },
      select: { name: true },
      take: 250,
    }),
  ])

  if (!wedding) throw new Error('Active wedding was not found.')

  const clientTerms = [
    wedding.title,
    wedding.tagline,
    wedding.venue,
    wedding.couple.partner1,
    wedding.couple.partner2,
    wedding.couple.surname,
    `${wedding.couple.partner1} & ${wedding.couple.partner2}`,
    ...guests.map((guest) => guest.name),
    ...vendors.map((vendor) => vendor.name),
  ].filter((term): term is string => Boolean(term?.trim()))

  const material = [input.name, input.description ?? '', input.content].join('\n')
  const findings = scanSensitiveTemplateContent(material, clientTerms)
  return {
    safe: findings.length === 0,
    findings,
    reviewedTerms: clientTerms.length,
  }
}

export async function createReviewedAiTemplateVersion(input: {
  weddingId: string
  authorId: string
  templateId?: string
  name: string
  description?: string
  content: string
  createdFrom?: AiTemplateVersionValue['createdFrom']
}) {
  const requestedTemplateId = clean(input.templateId, 100)
  const templateId =
    requestedTemplateId || `aitpl_${randomUUID().replace(/-/g, '')}`
  if (!/^aitpl_[a-zA-Z0-9]+$/.test(templateId)) {
    throw new Error('Invalid AI template id.')
  }

  const name = clean(input.name, 180) || 'Untitled AI template'
  const description = clean(input.description, 1_500)
  const content = clean(input.content, 60_000)
  if (!content) throw new Error('Template content is required.')

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-template-version:${input.weddingId}:${templateId}`}))`

    const previous = await tx.contentRevision.findFirst({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.template,
        fieldKey: templateId,
      },
      orderBy: { createdAt: 'desc' },
    })
    if (requestedTemplateId && !previous) {
      throw new Error('AI template family not found for the active wedding.')
    }

    let previousValue: AiTemplateVersionValue | null = null
    if (previous) {
      try {
        previousValue = parse<AiTemplateVersionValue>(previous.value)
      } catch {
        throw new Error('Previous AI template version is invalid.')
      }
    }

    const value: AiTemplateVersionValue = {
      schemaVersion: 1,
      templateId,
      version: (previousValue?.version ?? 0) + 1,
      name,
      description,
      content,
      items: extractTemplateItems(content),
      anonymized: true,
      createdFrom: input.createdFrom ?? 'ai',
      createdAt: new Date().toISOString(),
    }

    const row = await tx.contentRevision.create({
      data: {
        section: AI_SECTIONS.template,
        fieldKey: templateId,
        value: JSON.stringify(value),
        status: 'draft',
        previousValue: previous?.value ?? null,
        weddingId: input.weddingId,
        authorId: input.authorId,
      },
    })
    await tx.auditEvent.create({
      data: {
        action: 'ai.template.version.create',
        resourceType: AI_SECTIONS.template,
        resourceId: row.id,
        beforeValue: previous?.value ?? null,
        afterValue: row.value,
        weddingId: input.weddingId,
        actorId: input.authorId,
      },
    })

    return response(row, value)
  })
}
