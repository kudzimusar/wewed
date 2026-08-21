import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
  timingSafeEqual,
} from 'node:crypto'
import { isIP } from 'node:net'

const WEB_PUSH_RECORD_SIZE = 4096
const MAX_WEB_PUSH_PLAINTEXT = 3993
const VAPID_LIFETIME_SECONDS = 12 * 60 * 60

export interface DirectWebPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface WebPushSendResult {
  ok: boolean
  status: number | null
  expired: boolean
  retriable: boolean
  errorCode?: string
}

interface VapidConfiguration {
  publicKey: string
  publicPoint: Buffer
  privateKey: Buffer
  subject: string
}

interface EncryptionOptions {
  salt?: Buffer
  serverPrivateKey?: Buffer
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

function hmac(key: Buffer, value: Buffer): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function hkdfExpandOneBlock(prk: Buffer, info: Buffer, length: number): Buffer {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length)
}

function validVapidSubject(value: string): boolean {
  if (value.startsWith('mailto:')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.slice('mailto:'.length))
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

function privateIpv6(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value)
  )
}

export function isSafeWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const hostname = url.hostname.toLowerCase()
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return false
    const ipVersion = isIP(hostname)
    if (ipVersion === 4 && privateIpv4(hostname)) return false
    if (ipVersion === 6 && privateIpv6(hostname)) return false
    return true
  } catch {
    return false
  }
}

function vapidConfiguration(): VapidConfiguration | null {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
  const privateValue = process.env.WEWED_WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.WEWED_WEB_PUSH_VAPID_SUBJECT?.trim()
  if (!publicKey || !privateValue || !subject || !validVapidSubject(subject)) return null

  try {
    const publicPoint = decodeBase64Url(publicKey)
    const privateKey = decodeBase64Url(privateValue)
    if (publicPoint.length !== 65 || publicPoint[0] !== 0x04 || privateKey.length !== 32) return null

    const ecdh = createECDH('prime256v1')
    ecdh.setPrivateKey(privateKey)
    const derivedPublic = ecdh.getPublicKey()
    if (derivedPublic.length !== publicPoint.length || !timingSafeEqual(derivedPublic, publicPoint)) return null

    return { publicKey, publicPoint, privateKey, subject }
  } catch {
    return null
  }
}

export function directWebPushConfigured(): boolean {
  return Boolean(vapidConfiguration())
}

export function encryptWebPushPayload(
  subscription: Pick<DirectWebPushSubscription, 'p256dh' | 'auth'>,
  payload: Buffer | string,
  options: EncryptionOptions = {},
): Buffer {
  const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8')
  if (plaintext.length > MAX_WEB_PUSH_PLAINTEXT) {
    throw new Error(`Web Push payload exceeds ${MAX_WEB_PUSH_PLAINTEXT} bytes.`)
  }

  const userAgentPublic = decodeBase64Url(subscription.p256dh)
  const authSecret = decodeBase64Url(subscription.auth)
  if (userAgentPublic.length !== 65 || userAgentPublic[0] !== 0x04) {
    throw new Error('Web Push subscription public key is invalid.')
  }
  if (authSecret.length !== 16) throw new Error('Web Push authentication secret is invalid.')

  const applicationServer = createECDH('prime256v1')
  if (options.serverPrivateKey) applicationServer.setPrivateKey(options.serverPrivateKey)
  else applicationServer.generateKeys()
  const applicationServerPublic = applicationServer.getPublicKey()
  const ecdhSecret = applicationServer.computeSecret(userAgentPublic)

  const prkKey = hmac(authSecret, ecdhSecret)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info', 'ascii'),
    Buffer.from([0]),
    userAgentPublic,
    applicationServerPublic,
  ])
  const ikm = hkdfExpandOneBlock(prkKey, keyInfo, 32)

  const salt = options.salt ?? randomBytes(16)
  if (salt.length !== 16) throw new Error('Web Push salt must be 16 bytes.')
  const prk = hmac(salt, ikm)
  const cek = hkdfExpandOneBlock(
    prk,
    Buffer.concat([Buffer.from('Content-Encoding: aes128gcm', 'ascii'), Buffer.from([0])]),
    16,
  )
  const nonce = hkdfExpandOneBlock(
    prk,
    Buffer.concat([Buffer.from('Content-Encoding: nonce', 'ascii'), Buffer.from([0])]),
    12,
  )

  const recordPlaintext = Buffer.concat([plaintext, Buffer.from([0x02])])
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const ciphertext = Buffer.concat([cipher.update(recordPlaintext), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(WEB_PUSH_RECORD_SIZE, 16)
  header.writeUInt8(applicationServerPublic.length, 20)

  return Buffer.concat([header, applicationServerPublic, ciphertext])
}

function vapidAuthorization(endpoint: string, config: VapidConfiguration, now = new Date()): string {
  const audience = new URL(endpoint).origin
  const header = encodeBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const payload = encodeBase64Url(JSON.stringify({
    aud: audience,
    exp: Math.floor(now.getTime() / 1000) + VAPID_LIFETIME_SECONDS,
    sub: config.subject,
  }))
  const signingInput = `${header}.${payload}`

  const publicPoint = config.publicPoint
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: encodeBase64Url(publicPoint.subarray(1, 33)),
    y: encodeBase64Url(publicPoint.subarray(33, 65)),
    d: encodeBase64Url(config.privateKey),
  }
  const key = createPrivateKey({ key: jwk, format: 'jwk' })
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key,
    dsaEncoding: 'ieee-p1363',
  })
  return `vapid t=${signingInput}.${encodeBase64Url(signature)}, k=${config.publicKey}`
}

export async function sendDirectWebPush(
  subscription: DirectWebPushSubscription,
  notificationPayload: unknown,
): Promise<WebPushSendResult> {
  const config = vapidConfiguration()
  if (!config) {
    return { ok: false, status: null, expired: false, retriable: false, errorCode: 'TRANSPORT_NOT_CONFIGURED' }
  }
  if (!isSafeWebPushEndpoint(subscription.endpoint)) {
    return { ok: false, status: null, expired: true, retriable: false, errorCode: 'UNSAFE_ENDPOINT' }
  }

  try {
    const body = encryptWebPushPayload(subscription, JSON.stringify(notificationPayload))
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthorization(subscription.endpoint, config),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) return { ok: true, status: response.status, expired: false, retriable: false }
    const expired = response.status === 404 || response.status === 410
    const retriable = [408, 409, 425, 429].includes(response.status) || response.status >= 500
    return {
      ok: false,
      status: response.status,
      expired,
      retriable,
      errorCode: `HTTP_${response.status}`,
    }
  } catch (error) {
    console.error('[web-push] Direct send failed:', error)
    return { ok: false, status: null, expired: false, retriable: true, errorCode: 'NETWORK_OR_ENCRYPTION_ERROR' }
  }
}
