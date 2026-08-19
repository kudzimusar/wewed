import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

const KINDS = new Set(['individual','family','organisation'])
const CONTACT_METHODS = new Set(['email','phone','other'])

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const rows = await db.$queryRaw<Array<{ id:string; displayName:string; legalName:string|null; kind:string; relationship:string|null; email:string|null; phone:string|null; address:string|null; preferredContactMethod:string|null; publicRecognition:boolean; anonymousPublic:boolean; notes:string|null; guestId:string|null }>>`
    SELECT id, display_name AS "displayName", legal_name AS "legalName", kind, relationship, email, phone, address,
           preferred_contact_method AS "preferredContactMethod", public_recognition AS "publicRecognition",
           anonymous_public AS "anonymousPublic", notes, guest_id AS "guestId"
      FROM wewed_contributions.contributors
     WHERE id = ${id} AND wedding_id = ${weddingId}
     LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ success:false, error:'Contributor not found.' }, { status:404 })
  const history = await db.$queryRaw<Array<{ id:string; title:string; type:string; amount:string|null; currency:string; estimatedValue:string|null; estimatedValueCurrency:string|null; fulfillmentState:string; thankYouState:string; createdAt:Date }>>`
    SELECT id, title, type, amount::text AS amount, currency, estimated_value::text AS "estimatedValue",
           estimated_value_currency AS "estimatedValueCurrency", fulfillment_state AS "fulfillmentState",
           thank_you_state AS "thankYouState", created_at AS "createdAt"
      FROM wewed_contributions.wedding_contributions
     WHERE wedding_id = ${weddingId} AND contributor_id = ${id}
     ORDER BY created_at DESC
  `
  return NextResponse.json({ success:true, data:{ ...rows[0], history: history.map((item) => ({ ...item, amount:item.amount===null?null:Number(item.amount), estimatedValue:item.estimatedValue===null?null:Number(item.estimatedValue), createdAt:item.createdAt.toISOString() })) } })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  const body = (await request.json()) as Record<string, unknown>
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null
  if (body.displayName !== undefined && !displayName) return NextResponse.json({ success:false, error:'Contributor name is required.' }, { status:400 })
  const kind = body.kind === undefined ? null : String(body.kind).trim().toLowerCase()
  if (kind && !KINDS.has(kind)) return NextResponse.json({ success:false, error:'Choose a valid contributor type.' }, { status:400 })
  const preferred = body.preferredContactMethod === undefined ? undefined : String(body.preferredContactMethod ?? '').trim().toLowerCase() || null
  if (preferred && !CONTACT_METHODS.has(preferred)) return NextResponse.json({ success:false, error:'Choose a valid contact preference.' }, { status:400 })
  const email = body.email === undefined ? undefined : String(body.email ?? '').trim().toLowerCase() || null
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ success:false, error:'Enter a valid contributor email.' }, { status:400 })
  const existing = await db.$queryRaw<Array<{ id:string }>>`SELECT id FROM wewed_contributions.contributors WHERE id=${id} AND wedding_id=${weddingId} LIMIT 1`
  if (!existing[0]) return NextResponse.json({ success:false, error:'Contributor not found.' }, { status:404 })
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE wewed_contributions.contributors
         SET display_name = COALESCE(${displayName}, display_name),
             legal_name = CASE WHEN ${body.legalName !== undefined} THEN ${String(body.legalName ?? '').trim() || null} ELSE legal_name END,
             kind = COALESCE(${kind}, kind),
             relationship = CASE WHEN ${body.relationship !== undefined} THEN ${String(body.relationship ?? '').trim() || null} ELSE relationship END,
             email = CASE WHEN ${body.email !== undefined} THEN ${email} ELSE email END,
             phone = CASE WHEN ${body.phone !== undefined} THEN ${String(body.phone ?? '').trim() || null} ELSE phone END,
             address = CASE WHEN ${body.address !== undefined} THEN ${String(body.address ?? '').trim() || null} ELSE address END,
             preferred_contact_method = CASE WHEN ${body.preferredContactMethod !== undefined} THEN ${preferred} ELSE preferred_contact_method END,
             public_recognition = CASE WHEN ${body.publicRecognition !== undefined} THEN ${body.publicRecognition === true} ELSE public_recognition END,
             anonymous_public = CASE WHEN ${body.anonymousPublic !== undefined} THEN ${body.anonymousPublic === true} ELSE anonymous_public END,
             notes = CASE WHEN ${body.notes !== undefined} THEN ${String(body.notes ?? '').trim() || null} ELSE notes END,
             updated_at = NOW()
       WHERE id = ${id} AND wedding_id = ${weddingId}
    `
    await tx.auditEvent.create({ data:{ weddingId, action:'contributor.updated', actorId, resourceType:'Contributor', resourceId:id, afterValue:JSON.stringify({ fields:Object.keys(body) })} })
  })
  return NextResponse.json({ success:true })
}
