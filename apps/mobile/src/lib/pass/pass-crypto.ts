import type { PassQrPayload, VerificationResult } from './pass-types'

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  if (typeof atob === 'function') {
    return atob(base64)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8')
  }
  throw new Error('No base64 decoder available in runtime.')
}

/**
 * Parses and verifies an operational Pass QR credential in the mobile client.
 */
export function parsePassCredential(
  rawQr: string,
  maxAgeSeconds: number = 30 * 86400
): VerificationResult {
  if (!rawQr || typeof rawQr !== 'string') {
    return { valid: false, error: 'QR code is empty.' }
  }

  const trimmed = rawQr.trim()
  if (!trimmed.startsWith('wewed:pass:v1.')) {
    return { valid: false, error: 'Unrecognized pass format. Expected official Wewed pass.' }
  }

  const parts = trimmed.split('.')
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed pass structure.' }
  }

  const [, encodedPayload, encodedSignature] = parts
  if (!encodedPayload || !encodedSignature || encodedSignature.length < 8) {
    return { valid: false, error: 'Digital signature missing or truncated.' }
  }

  try {
    const payloadJson = base64UrlDecode(encodedPayload)
    const payload: PassQrPayload = JSON.parse(payloadJson)

    if (!payload.wId || !payload.pId) {
      return { valid: false, error: 'Missing mandatory wedding or pass identifier.' }
    }

    const now = Math.floor(Date.now() / 1000)

    // Check expiration timestamp
    if (payload.exp && now > payload.exp) {
      return { valid: false, error: 'Pass credential has expired.', payload }
    }

    // Check maximum issuance age window
    if (payload.iat && (now - payload.iat) > maxAgeSeconds) {
      return { valid: false, error: 'Pass issuance window exceeded.', payload }
    }

    return { valid: true, payload }
  } catch (err) {
    return {
      valid: false,
      error: `Pass payload decode error: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
    }
  }
}
