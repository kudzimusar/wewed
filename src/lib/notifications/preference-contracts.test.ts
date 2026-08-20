import { describe, expect, it } from 'bun:test'
import { notificationPreferenceInputSchema } from './preference-contracts'

describe('notification preference contract', () => {
  it('accepts instant external delivery with a valid timezone and complete quiet hours', () => {
    const parsed = notificationPreferenceInputSchema.parse({
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: true,
      whatsAppEnabled: false,
      timezone: 'Africa/Harare',
      quietStart: '22:00',
      quietEnd: '07:00',
      digestMode: 'none',
    })
    expect(parsed.inAppEnabled).toBe(true)
    expect(parsed.timezone).toBe('Africa/Harare')
    expect(parsed.quietStart).toBe('22:00')
    expect(parsed.quietEnd).toBe('07:00')
    expect(parsed.digestMode).toBe('none')
  })

  it('rejects disabling canonical in-app notification history', () => {
    expect(() => notificationPreferenceInputSchema.parse({ inAppEnabled: false })).toThrow()
  })

  it('rejects digest modes until a real digest generator exists', () => {
    expect(() => notificationPreferenceInputSchema.parse({ digestMode: 'daily' })).toThrow()
    expect(() => notificationPreferenceInputSchema.parse({ digestMode: 'weekly' })).toThrow()
  })

  it('rejects invalid timezones instead of silently suppressing delivery', () => {
    expect(() => notificationPreferenceInputSchema.parse({ timezone: 'Definitely/Not-A-Timezone' })).toThrow()
  })

  it('requires both quiet-hour boundaries and rejects equal boundaries', () => {
    expect(() => notificationPreferenceInputSchema.parse({ quietStart: '22:00' })).toThrow()
    expect(() => notificationPreferenceInputSchema.parse({ quietEnd: '07:00' })).toThrow()
    expect(() => notificationPreferenceInputSchema.parse({ quietStart: '22:00', quietEnd: '22:00' })).toThrow()
  })
})
