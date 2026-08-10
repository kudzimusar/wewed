import { describe, expect, test } from 'bun:test'
import { normalizeMailboxEnvironmentValue } from './mailbox-config'

describe('normalizeMailboxEnvironmentValue', () => {
  test('preserves a valid Wewed display name when requested', () => {
    expect(
      normalizeMailboxEnvironmentValue('Wewed <notifications@updates.wewed.pro>', {
        preserveDisplayName: true,
      }),
    ).toBe('Wewed <notifications@updates.wewed.pro>')
  })

  test('repairs copied environment assignments and wrapper quotes', () => {
    expect(
      normalizeMailboxEnvironmentValue(
        'WEWED_EMAIL_FROM="Wewed <notifications@updates.wewed.pro>"',
        { preserveDisplayName: true },
      ),
    ).toBe('Wewed <notifications@updates.wewed.pro>')

    expect(
      normalizeMailboxEnvironmentValue('`support@wewed.pro`'),
    ).toBe('support@wewed.pro')
  })

  test('reduces reply-to display syntax to one valid mailbox', () => {
    expect(
      normalizeMailboxEnvironmentValue('Support <support@wewed.pro>'),
    ).toBe('support@wewed.pro')
  })

  test('fails closed for ambiguous or non-mailbox values', () => {
    expect(normalizeMailboxEnvironmentValue('not-an-email')).toBeNull()
    expect(
      normalizeMailboxEnvironmentValue('a@wewed.pro b@wewed.pro'),
    ).toBeNull()
    expect(
      normalizeMailboxEnvironmentValue('prefix notifications@updates.wewed.pro'),
    ).toBeNull()
  })
})
