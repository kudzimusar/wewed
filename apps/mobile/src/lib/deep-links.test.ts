import { describe, expect, test } from 'bun:test'
import { handoffPath, nativeIntentPath, resolveWewedLink } from './deep-links'

describe('resolveWewedLink', () => {
  test('routes authenticated Wewed app links to the native shell', () => {
    expect(resolveWewedLink('https://wewed.pro/app')).toMatchObject({
      nativePath: '/(tabs)',
      requiresAuthentication: true,
      secureWebOnly: false,
    })
  })

  test('routes message conversations to native messages', () => {
    expect(resolveWewedLink('https://wewed.pro/messages/conversation-123')).toMatchObject({
      nativePath: '/messages/conversation-123',
      requiresAuthentication: true,
    })
  })

  test('routes provider profiles to the native marketplace profile', () => {
    expect(resolveWewedLink('https://wewed.pro/vendors/shandy-events')).toMatchObject({
      nativePath: '/providers/shandy-events',
      requiresAuthentication: false,
    })
  })

  test('routes governed booking details natively', () => {
    expect(resolveWewedLink('https://wewed.pro/bookings/booking-123')).toMatchObject({
      nativePath: '/bookings/booking-123',
      requiresAuthentication: true,
    })
  })

  test('keeps exact contract review on its canonical secure surface', () => {
    expect(resolveWewedLink('https://wewed.pro/contracts/review/secret-review-token')).toMatchObject({
      nativePath: null,
      secureWebOnly: true,
      requiresAuthentication: false,
    })
  })

  test('normalizes the Wewed custom scheme', () => {
    expect(resolveWewedLink('wewed://messages/conversation-123')).toMatchObject({
      canonicalUrl: 'https://wewed.pro/messages/conversation-123',
      nativePath: '/messages/conversation-123',
    })
  })

  test('does not translate a hostile host into a trusted Wewed route', () => {
    expect(resolveWewedLink('https://example.invalid/messages/conversation-123')).toMatchObject({
      canonicalUrl: 'https://wewed.pro/app',
      nativePath: '/(tabs)',
      requiresAuthentication: true,
    })
  })

  test('handoff paths carry only the normalized Wewed destination', () => {
    const path = handoffPath('https://www.wewed.pro/bookings/abc?source=push')
    expect(path.startsWith('/handoff?url=')).toBe(true)
    expect(decodeURIComponent(path.split('=')[1] ?? '')).toBe('https://wewed.pro/bookings/abc?source=push')
  })
})

describe('nativeIntentPath', () => {
  test('keeps a normal Android launcher root at the application root', () => {
    expect(nativeIntentPath('wewed:///')).toBe('/')
    expect(nativeIntentPath('https://wewed.pro/')).toBe('/')
    expect(nativeIntentPath('https://wewed.pro/app')).toBe('/')
  })

  test('preserves a real authenticated deep link through secure continuation', () => {
    const path = nativeIntentPath('wewed://messages/conversation-123')
    expect(path.startsWith('/handoff?url=')).toBe(true)
    expect(decodeURIComponent(path.split('=')[1] ?? '')).toBe('https://wewed.pro/messages/conversation-123')
  })

  test('keeps secure web-only routes in the handoff boundary', () => {
    const path = nativeIntentPath('https://wewed.pro/contracts/review/secret-review-token')
    expect(path.startsWith('/handoff?url=')).toBe(true)
    expect(decodeURIComponent(path.split('=')[1] ?? '')).toBe('https://wewed.pro/contracts/review/secret-review-token')
  })
})
