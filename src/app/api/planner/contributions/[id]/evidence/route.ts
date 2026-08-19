import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { getContribution } from '@/lib/contributions/store'
import { createVaultLink, prepareVaultUpload, registerPreparedVaultObject, removePreparedVaultUpload } from '@/lib/vault/core'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id:string }> }

async function ensureContribution(weddingId:string, id:string) {
  const contribution = await getContribution(weddingId, id)
  if (!contribution) throw new Error('CONTRIBUTION_NOT_FOUND')
  return contribution
}

export async function GET(request:NextRequest, context:RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  try {
    await ensureContribution(weddingId, id)
    const links = await db.vaultLink.findMany({ where:{ weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence' }, include:{ vaultObject:true }, orderBy:{ createdAt:'desc' } })
    return NextResponse.json({ success:true, data:links.filter((link) => !link.vaultObject.deletedAt).map((link) => ({ id:link.id, vaultObjectId:link.vaultObjectId, displayName:link.vaultObject.displayName, mimeType:link.vaultObject.mimeType, byteSize:Number(link.vaultObject.byteSize), storageState:link.vaultObject.storageState, scanState:link.vaultObject.scanState, createdAt:link.createdAt.toISOString() })) })
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })
    console.error('[CONTRIBUTION EVIDENCE GET] error', error)
    return NextResponse.json({ success:false, error:'Could not load contribution evidence.' }, { status:500 })
  }
}

export async function POST(request:NextRequest, context:RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    await ensureContribution(weddingId, id)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ success:false, error:'Choose evidence to attach.' }, { status:400 })
    const prepared = await prepareVaultUpload({ file, weddingId, actorId, source:'contribution_evidence', category:'wedding_document', metadata:{ contributionId:id } })
    try {
      await db.$transaction(async (tx) => {
        await registerPreparedVaultObject(prepared, tx)
        await createVaultLink({ vaultObjectId:prepared.id, weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence', actorId, tx })
        await tx.auditEvent.create({ data:{ weddingId, action:'contribution.evidence_attached', actorId, resourceType:'WeddingContribution', resourceId:id, afterValue:JSON.stringify({ vaultObjectId:prepared.id, filename:prepared.displayName })} })
      })
    } catch (error) {
      await removePreparedVaultUpload(prepared)
      throw error
    }
    await logAuditEvent({ action:'vault.object.linked_to_contribution', resourceType:'VaultObject', resourceId:prepared.id, weddingId, actorId, afterValue:{ contributionId:id, linkRole:'evidence' } })
    return NextResponse.json({ success:true, data:{ vaultObjectId:prepared.id, displayName:prepared.displayName, available:prepared.distributable } }, { status:201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })
    console.error('[CONTRIBUTION EVIDENCE POST] error', error)
    const message = error instanceof Error ? error.message : 'Could not attach contribution evidence.'
    return NextResponse.json({ success:false, error:message }, { status:500 })
  }
}

export async function DELETE(request:NextRequest, context:RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    await ensureContribution(weddingId, id)
    const body = (await request.json()) as { linkId?:string }
    const linkId = String(body.linkId ?? '').trim()
    if (!linkId) return NextResponse.json({ success:false, error:'Evidence link is required.' }, { status:400 })
    const link = await db.vaultLink.findFirst({ where:{ id:linkId, weddingId, entityType:'WeddingContribution', entityId:id, linkRole:'evidence' }, select:{ id:true, vaultObjectId:true } })
    if (!link) return NextResponse.json({ success:false, error:'Evidence link not found.' }, { status:404 })
    await db.$transaction(async (tx) => {
      await tx.vaultLink.delete({ where:{ id:link.id } })
      await tx.auditEvent.create({ data:{ weddingId, action:'contribution.evidence_unlinked', actorId, resourceType:'WeddingContribution', resourceId:id, afterValue:JSON.stringify({ vaultObjectId:link.vaultObjectId })} })
    })
    return NextResponse.json({ success:true })
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTRIBUTION_NOT_FOUND') return NextResponse.json({ success:false, error:'Contribution not found.' }, { status:404 })
    console.error('[CONTRIBUTION EVIDENCE DELETE] error', error)
    return NextResponse.json({ success:false, error:'Could not unlink contribution evidence.' }, { status:500 })
  }
}
