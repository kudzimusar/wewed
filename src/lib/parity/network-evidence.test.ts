import { expect, test } from 'bun:test'
import { classifyParityResponse, redactPath } from '@/lib/parity/network-evidence'

test('network evidence never keeps a query value', () => {
  expect(redactPath('/api/native/wedding/guests?grantId=planner:wedding:w1&q=Name')).toBe('/api/native/wedding/guests?grantId=<redacted>&q=<redacted>')
  expect(redactPath('/api/weddings/charity-and-kudzie/guest-session/exchange?token=SECRET')).not.toContain('SECRET')
  expect(redactPath('/api/auth/me')).toBe('/api/auth/me')
})

test('Vercel Deployment Protection is never mistaken for an application answer', () => {
  // Observed on the integration Preview: API-style requests get 401 JSON, plain requests a 302.
  expect(classifyParityResponse(401, { error: { code: '401', message: 'Protected deployment' }, protection: {} }, null))
    .toBe('vercel-deployment-protection')
  expect(classifyParityResponse(302, {}, 'https://vercel.com/sso-api?url=x')).toBe('vercel-deployment-protection')
  expect(classifyParityResponse(401, { success: false, error: 'Your session is no longer valid.' }, null)).toBe('refused')
  expect(classifyParityResponse(503, { success: false, code: 'WEDDING_DAY_DISABLED' }, null)).toBe('WEDDING_DAY_DISABLED')
  expect(classifyParityResponse(409, { success: false, code: 'PASS_NOT_YET_ISSUABLE' }, null)).toBe('PASS_NOT_YET_ISSUABLE')
  expect(classifyParityResponse(200, { success: true, authorized: true }, null)).toBe('success')
})
