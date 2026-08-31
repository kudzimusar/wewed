import { NextResponse } from 'next/server'
import { getWewedAiModelRelease, WEWED_AI_SKILLS } from '@/lib/ai/core'

export async function GET() {
  const release = getWewedAiModelRelease()
  return NextResponse.json({
    success: true,
    service: 'Wewed AI Core',
    architecture: 'one-core-one-model-release-many-skills',
    modelReleaseId: release.releaseId,
    skills: Object.values(WEWED_AI_SKILLS).map((skill) => ({
      id: skill.id,
      version: skill.version,
      promptReleaseId: skill.promptReleaseId,
      authorities: skill.allowedAuthorities,
      outcomes: skill.outcomes,
    })),
    authorityLadder: ['explain', 'suggest', 'simulate', 'draft', 'prepare', 'execute'],
    executeEnabledByDefault: false,
    deterministicAuthorities: [
      'pricing',
      'availability',
      'payment evidence',
      'contribution funding',
      'booking state',
      'contract consent',
      'communications sending',
    ],
  })
}
