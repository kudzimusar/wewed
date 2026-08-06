import {
  generateAiText,
  getAiDiagnostics,
  type AiProviderName,
} from '../src/lib/ai'

const TEST_PROMPT =
  'Reply with exactly: WEWED_AI_OK. Do not add punctuation or explanation.'

async function testProvider(provider: AiProviderName): Promise<boolean> {
  const startedAt = performance.now()

  try {
    const result = await generateAiText({
      provider,
      profile: 'anonymized',
      allowFallback: false,
      maxOutputTokens: 32,
      messages: [
        {
          role: 'system',
          content: 'You are a deterministic API connectivity test.',
        },
        { role: 'user', content: TEST_PROMPT },
      ],
    })

    const elapsedMs = Math.round(performance.now() - startedAt)
    const exact = result.text.trim() === 'WEWED_AI_OK'
    console.log(
      `PASS ${provider.padEnd(7)} model=${result.model} latency=${elapsedMs}ms exact=${exact}`
    )
    return true
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    console.error(
      `FAIL ${provider.padEnd(7)} latency=${elapsedMs}ms error=${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
    return false
  }
}

async function main(): Promise<void> {
  const diagnostics = getAiDiagnostics()
  const configured = diagnostics.providers.filter(
    (provider) => provider.configured
  )

  console.log('wewed AI provider smoke test')
  console.log(
    `routing private=${diagnostics.routing.privateProvider} quality=${diagnostics.routing.qualityProvider} fallback=${diagnostics.routing.fallbackProvider}`
  )

  if (configured.length === 0) {
    console.error(
      'No API keys found. Copy .env.example to .env.local and add at least one provider key.'
    )
    process.exitCode = 1
    return
  }

  let failures = 0
  for (const status of configured) {
    const passed = await testProvider(status.provider)
    if (!passed) failures += 1
  }

  if (failures > 0) {
    console.error(`${failures} configured provider test(s) failed.`)
    process.exitCode = 1
    return
  }

  console.log('All configured AI providers responded successfully.')
}

void main()
