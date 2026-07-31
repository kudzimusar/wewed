import { NextRequest } from 'next/server'
import { handleImportJobGet } from '@/lib/import-engine/import-job-get'
import { handleImportJobPost } from '@/lib/import-engine/import-job-post'
import { handleImportJobDelete } from '@/lib/import-engine/import-job-rollback'
import type { ImportJobRouteContext } from '@/lib/import-engine/import-job-shared'

export async function GET(request: NextRequest, context: ImportJobRouteContext) {
  return handleImportJobGet(request, context)
}

export async function POST(request: NextRequest, context: ImportJobRouteContext) {
  return handleImportJobPost(request, context)
}

export async function DELETE(request: NextRequest, context: ImportJobRouteContext) {
  return handleImportJobDelete(request, context)
}
