import { afterEach, describe, expect, test } from 'bun:test'
import { getWewedAiModelRelease } from './model-release'
import { runWewedAi, WewedAiPolicyError } from './orchestrator'
import { WEWED_AI_SKILLS } from './skill-registry'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe('Wewed AI model release', () => {
  test('has one centrally versioned default language model', () => {
    delete process.env.WEWED_AI_MODEL_RELEASE_ID
    delete process.env.WEWED_AI_DEFAULT_PROVIDER
    delete process.env.WEWED_AI_DEFAULT_MODEL
    const release = getWewedAiModelRelease()
    expect(release.releaseId).toBe('wewed-ai-2026-08-a')
    expect(release.profiles.default_language.primary).toEqual({
      provider: 'zai',
      model: 'glm-4.7-flash',
    })
  })

  test('changes the global default from one release configuration point', () => {
    process.env.WEWED_AI_MODEL_RELEASE_ID = 'wewed-ai-test-b'
    process.env.WEWED_AI_DEFAULT_PROVIDER = 'groq'
    process.env.WEWED_AI_DEFAULT_MODEL = 'openai/gpt-oss-120b'
    const release = getWewedAiModelRelease()
    expect(release.releaseId).toBe('wewed-ai-test-b')
    expect(release.profiles.default_language.primary.provider).toBe('groq')
    expect(release.profiles.default_language.primary.model).toBe('openai/gpt-oss-120b')
  })
})

describe('Wewed AI skill registry', () => {
  test('registers the product-wide AI organisation on the same core contract', () => {
    expect(Object.keys(WEWED_AI_SKILLS)).toEqual(expect.arrayContaining([
      'wedding_architect',
      'couple_coach',
      'planner_copilot',
      'marketplace_concierge',
      'booking_assistant',
      'vendor_copilot',
      'budget_analyst',
      'contributions_assistant',
      'contract_terms_explainer',
      'communications_copilot',
      'guest_concierge',
      'timeline_task_copilot',
      'admin_support_ai',
      'visual_design_director',
    ]))
  })

  test('does not give any initial skill general execute authority', () => {
    for (const skill of Object.values(WEWED_AI_SKILLS)) {
      expect(skill.allowedAuthorities).not.toContain('execute')
    }
  })
})

describe('Wewed AI policy enforcement', () => {
  test('rejects role escalation before provider execution', async () => {
    await expect(runWewedAi({
      skill: 'admin_support_ai',
      outcome: 'support_summary',
      authority: 'explain',
      input: 'Summarise the account.',
      context: {
        actor: { role: 'public', permissions: [] },
        surface: { route: '/test' },
        dataProfile: 'public',
        facts: {},
        actionBoundary: 'explain',
      },
    })).rejects.toBeInstanceOf(WewedAiPolicyError)
  })

  test('rejects authority above the context boundary before provider execution', async () => {
    await expect(runWewedAi({
      skill: 'marketplace_concierge',
      outcome: 'prepare_enquiry',
      authority: 'prepare',
      input: 'Prepare an enquiry.',
      context: {
        actor: { role: 'public', permissions: [] },
        surface: { route: '/vendors/example' },
        dataProfile: 'public',
        facts: {},
        actionBoundary: 'suggest',
      },
    })).rejects.toMatchObject({ code: 'context_authority_exceeded' })
  })
})
