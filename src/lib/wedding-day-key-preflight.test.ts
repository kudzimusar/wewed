import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { formatKeyPreflightReport, weddingDayKeyPreflight } from './wedding-day-key-preflight'
import { assertWeddingDayWW2RuntimeReady } from './wedding-day-feature'

const p256 = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const p384 = () => generateKeyPairSync('ec', { namedCurve: 'secp384r1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const rsa = () => generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const complete = () => ({
  WEDDING_DAY_WW2_PRIVATE_KEY_PEM: p256(),
  WEDDING_DAY_WW2_KEY_ID: 'ww2-test-v1',
  WEDDING_DAY_ROOT_PRIVATE_KEY_PEM: p256(),
  WEDDING_DAY_ROOT_KEY_ID: 'root-test-v1',
}) as NodeJS.ProcessEnv

const find = (report: ReturnType<typeof weddingDayKeyPreflight>, needle: string) =>
  report.checks.find((c) => c.name.includes(needle))

describe('wedding day key preflight', () => {
  test('a complete, correct configuration passes every check', () => {
    const report = weddingDayKeyPreflight(complete())
    expect(report.ok).toBe(true)
    expect(find(report, 'curve is P-256')?.status).toBe('pass')
    expect(find(report, 'IEEE-P1363')?.status).toBe('pass')
    expect(find(report, 'verifies its own signature')?.status).toBe('pass')
    expect(find(report, 'distinct')?.status).toBe('pass')
  })

  test('P1363 signatures are exactly 64 bytes / 128 hex', () => {
    const report = weddingDayKeyPreflight(complete())
    expect(find(report, 'IEEE-P1363')?.detail).toContain('64 bytes / 128 hex')
  })

  test('an empty environment reports absent rather than throwing', () => {
    const report = weddingDayKeyPreflight({})
    expect(report.ok).toBe(false)
    expect(find(report, 'WW2 pass key: present')?.status).toBe('absent')
    expect(find(report, 'WEDDING_DAY_WW2_KEY_ID')?.status).toBe('absent')
  })

  test('a wrong curve is rejected', () => {
    const env = { ...complete(), WEDDING_DAY_WW2_PRIVATE_KEY_PEM: p384() }
    const report = weddingDayKeyPreflight(env)
    expect(report.ok).toBe(false)
    expect(find(report, 'curve is P-256')?.status).toBe('fail')
    expect(find(report, 'curve is P-256')?.detail).toContain('expected prime256v1')
  })

  test('a non-EC key is rejected', () => {
    const report = weddingDayKeyPreflight({ ...complete(), WEDDING_DAY_WW2_PRIVATE_KEY_PEM: rsa() })
    expect(report.ok).toBe(false)
    expect(find(report, 'curve is P-256')?.status).toBe('fail')
  })

  test('unparseable key material fails without echoing it', () => {
    const secret = 'NOT-A-KEY-BUT-SENSITIVE-LOOKING-abc123'
    const report = weddingDayKeyPreflight({ ...complete(), WEDDING_DAY_WW2_PRIVATE_KEY_PEM: secret })
    expect(report.ok).toBe(false)
    expect(find(report, 'parses')?.status).toBe('fail')
    expect(JSON.stringify(report)).not.toContain(secret)
  })

  test('reusing one key for both roles is rejected', () => {
    const shared = p256()
    const report = weddingDayKeyPreflight({
      ...complete(),
      WEDDING_DAY_WW2_PRIVATE_KEY_PEM: shared,
      WEDDING_DAY_ROOT_PRIVATE_KEY_PEM: shared,
    })
    expect(report.ok).toBe(false)
    expect(find(report, 'distinct')?.status).toBe('fail')
  })

  test('escaped newlines in an env-var PEM are accepted', () => {
    const env = complete()
    const escaped = (env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM as string).replace(/\n/g, '\\n')
    expect(weddingDayKeyPreflight({ ...env, WEDDING_DAY_WW2_PRIVATE_KEY_PEM: escaped }).ok).toBe(true)
  })

  test('runtime readiness requires the complete two-key configuration when feature is enabled', () => {
    const env = complete()
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM
    process.env.WEDDING_DAY_WW2_KEY_ID = env.WEDDING_DAY_WW2_KEY_ID
    delete process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_ROOT_KEY_ID

    expect(() => assertWeddingDayWW2RuntimeReady())
      .toThrow('WEDDING_DAY_KEY_CONFIGURATION_INVALID')

    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    process.env.WEDDING_DAY_ROOT_KEY_ID = env.WEDDING_DAY_ROOT_KEY_ID
    expect(() => assertWeddingDayWW2RuntimeReady()).not.toThrow()

    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    delete process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_WW2_KEY_ID
    delete process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_ROOT_KEY_ID
  })

  test('neither the report nor its rendering ever contains private key material', () => {
    const env = complete()
    const report = weddingDayKeyPreflight(env)
    const rendered = formatKeyPreflightReport(report)
    for (const pem of [env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM, env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM]) {
      const body = (pem as string).replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
      expect(rendered).not.toContain(body.slice(0, 32))
      expect(JSON.stringify(report)).not.toContain(body.slice(0, 32))
    }
    expect(rendered).not.toContain('PRIVATE KEY')
    expect(rendered).toContain('SHA256:')
    expect(rendered).toContain('ww2-test-v1')
  })
})
