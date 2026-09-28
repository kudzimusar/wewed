import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveNativeGateOperationalContext } from '@/lib/native-gate-context'

export async function GET(request: NextRequest) {
  const resolved = await resolveNativeGateOperationalContext(request)
  if (!resolved.ok) return resolved.response

  const { grant } = resolved.context
  return noStoreJson({
    success: true,
    gateContext: {
      grantId: grant.grantId,
      assignmentId: grant.assignmentId,
      weddingId: grant.weddingId,
      weddingTitle: grant.weddingTitle,
      gateId: grant.gateId,
      gateName: grant.gateName,
      operatorUserId: grant.operatorUserId,
      capabilities: grant.capabilities,
    },
  })
}
