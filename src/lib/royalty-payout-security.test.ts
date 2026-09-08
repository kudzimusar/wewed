import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PAYOUT_MUTATIONS_DISABLED_CODE,
  PAYOUT_MUTATIONS_DISABLED_MESSAGE,
  payoutMutationsDisabledPayload,
} from './royalty-payout-security'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('legacy royalty payout security boundary', () => {
  test('returns a stable fail-closed response for every payout mutation', () => {
    expect(payoutMutationsDisabledPayload()).toEqual({
      success: false,
      code: PAYOUT_MUTATIONS_DISABLED_CODE,
      error: PAYOUT_MUTATIONS_DISABLED_MESSAGE,
    })
  })

  test('requires an active named platform administrator with billing permission', () => {
    const payoutRoute = source('src/app/api/royalty/payout/route.ts')
    const accountRoute = source(
      'src/app/api/royalty/payout-account/route.ts',
    )

    for (const route of [payoutRoute, accountRoute]) {
      expect(route).toContain('requireWewedAdmin')
      expect(route).toContain('"admin.billing.read"')
      expect(route).toContain('"admin.billing.manage"')
      expect(route).not.toContain('requireAdmin(')
    }
  })

  test('keeps payout writes disabled before request bodies or payment data are processed', () => {
    const payoutRoute = source('src/app/api/royalty/payout/route.ts')
    const accountRoute = source(
      'src/app/api/royalty/payout-account/route.ts',
    )

    for (const route of [payoutRoute, accountRoute]) {
      expect(route).toContain('payoutMutationsDisabledPayload()')
      expect(route).toContain('status: 503')
      expect(route).not.toContain('request.json()')
      expect(route).not.toContain('db.$transaction')
    }
  })

  test('never loads, decodes, or returns payout account references', () => {
    const payoutRoute = source('src/app/api/royalty/payout/route.ts')
    const accountRoute = source(
      'src/app/api/royalty/payout-account/route.ts',
    )
    const royaltyEngine = source('src/lib/royalty-engine.ts')
    const guardedSource = [payoutRoute, accountRoute, royaltyEngine].join('\n')
    const encryptedReferenceColumn = ['account', 'Reference', 'Encrypted'].join('')
    const debugReferenceField = ['_debug', 'Decrypted', 'Reference'].join('')
    const legacyEncoder = ['encode', 'Account', 'Reference', 'MVP'].join('')
    const legacyDecoder = ['decode', 'Account', 'Reference', 'MVP'].join('')
    const legacyEncodingPrefix = ['wewed', ':enc:', 'v1:'].join('')

    expect(accountRoute).toContain('maskedAccountDisplay: true')
    expect(guardedSource).not.toContain(encryptedReferenceColumn)
    expect(guardedSource).not.toContain(debugReferenceField)
    expect(guardedSource).not.toContain(legacyEncoder)
    expect(guardedSource).not.toContain(legacyDecoder)
    expect(guardedSource).not.toContain(legacyEncodingPrefix)
  })
})
