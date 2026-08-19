import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request:NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const wedding = await db.wedding.findUnique({ where:{ id:access.context.weddingId }, select:{ slug:true } })
  if (!wedding?.slug) return NextResponse.json({ success:false, error:'This wedding does not have a public slug yet.' }, { status:409 })
  return NextResponse.json({ success:true, data:{ path:`/w/${encodeURIComponent(wedding.slug)}#registry` } })
}
