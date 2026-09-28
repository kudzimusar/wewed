import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/deploy-database.yml', 'utf8')
const start = workflow.indexOf('  baseline-production-ledger:')
const end = workflow.indexOf('\n\n  audit-baseline:')
const baseline = workflow.slice(start, end)

describe('production ledger baseline workflow', () => {
  test('is a separate ledger-only mode', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(baseline).toContain("inputs.confirmation == 'baseline-wewed'")
    expect(baseline).toContain('prisma migrate resolve --applied')
    expect(baseline).not.toContain('prisma migrate deploy')
    expect(baseline).not.toContain('prisma migrate reset')
  })

  test('fails closed on the reviewed release branch and frozen QR authority', () => {
    expect(baseline).toContain('release/qro07-guest-pwa-play-ship-20260928')
    expect(baseline).toContain('print_JXVAAX6DRL')
    expect(baseline).toContain('print_CHRTYKDZ23')
    expect(baseline).toContain('Expected exactly 88 reviewed historical baseline migrations')
  })

  test('leaves both real guard migrations pending', () => {
    expect(baseline).toContain('20260825024000_notification_state_race_guard')
    expect(baseline).toContain('20260825030000_provider_listing_visibility_guard')
    expect(baseline).toContain('Exactly eight reviewed migrations remain pending')
  })
})
