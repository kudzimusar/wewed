import { describe, expect, test } from 'bun:test'
import {
  LOCAL_CI_E2E_PLANNER,
  isSafeLocalCiE2EEnvironment,
} from './e2e-environment'

const safeEnvironment: NodeJS.ProcessEnv = {
  CI: 'true',
  WEWED_E2E_MODE: '1',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/wewed?schema=public',
}

describe('local CI E2E authority guard', () => {
  test('accepts only explicit CI E2E mode on a loopback PostgreSQL database', () => {
    expect(isSafeLocalCiE2EEnvironment(safeEnvironment)).toBe(true)
    expect(isSafeLocalCiE2EEnvironment({
      ...safeEnvironment,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/wewed?schema=public',
    })).toBe(true)
  })

  test('fails closed when CI, E2E mode, database locality, or Vercel isolation is missing', () => {
    expect(isSafeLocalCiE2EEnvironment({ ...safeEnvironment, CI: 'false' })).toBe(false)
    expect(isSafeLocalCiE2EEnvironment({ ...safeEnvironment, WEWED_E2E_MODE: '0' })).toBe(false)
    expect(isSafeLocalCiE2EEnvironment({
      ...safeEnvironment,
      DATABASE_URL: 'postgresql://postgres:postgres@db.example.test:5432/wewed',
    })).toBe(false)
    expect(isSafeLocalCiE2EEnvironment({ ...safeEnvironment, VERCEL: '1' })).toBe(false)
    expect(isSafeLocalCiE2EEnvironment({ ...safeEnvironment, DATABASE_URL: 'not-a-url' })).toBe(false)
  })

  test('uses a synthetic non-production planner identity', () => {
    expect(LOCAL_CI_E2E_PLANNER.email.endsWith('@example.test')).toBe(true)
    expect(LOCAL_CI_E2E_PLANNER.id).toBe('e2e-planner-user')
    expect(LOCAL_CI_E2E_PLANNER.password).toBe('wewed-native-e2e-ci-only')
  })
})
