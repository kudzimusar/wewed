import { db } from '@/lib/db'

export type ImportJobRouteContext = { params: Promise<{ jobId: string }> }

export async function findImportJob(jobId: string, weddingId: string) {
  return db.importJob.findFirst({ where: { id: jobId, weddingId } })
}
