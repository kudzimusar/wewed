/**
 * Checks that the Wedding Day signing environment is configured correctly, without ever revealing
 * it.
 *
 * This exists so the question "are the production WW2 keys installed and usable?" can be answered
 * before a deployment depends on the answer, by an operator who is not entitled to see the keys
 * themselves — and so that answering it can never be the thing that leaks them. Nothing here
 * returns, logs or formats private key material: the only key-derived value it emits is a SHA-256
 * fingerprint of the *public* key, which is safe to paste into a ticket and is exactly what you
 * need to confirm two environments hold the same key.
 *
 * It does not create, rotate, activate or store anything.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from 'node:crypto'

export type CheckStatus = 'pass' | 'fail' | 'absent'

export interface PreflightCheck {
  name: string
  status: CheckStatus
  detail: string
}

export interface KeyPreflightReport {
  ok: boolean
  checks: PreflightCheck[]
}

/** The four variables the Wedding Day domain needs. Values are never included in the report. */
export const WEDDING_DAY_KEY_VARIABLES = [
  'WEDDING_DAY_WW2_PRIVATE_KEY_PEM',
  'WEDDING_DAY_WW2_KEY_ID',
  'WEDDING_DAY_ROOT_PRIVATE_KEY_PEM',
  'WEDDING_DAY_ROOT_KEY_ID',
] as const

function normalizePem(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\\n/g, '\n')
  return normalized ? normalized : null
}

/** Safe to publish: identifies a key without disclosing it. */
export function publicKeyFingerprint(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' })
  const digest = createHash('sha256').update(der).digest('hex')
  return `SHA256:${digest.match(/.{2}/g)!.join(':')}`
}

function curveOf(key: KeyObject): string | undefined {
  return (key.asymmetricKeyDetails as { namedCurve?: string } | undefined)?.namedCurve
}

/**
 * Validates one private key end to end: it parses, it is P-256, its public half derives, and a
 * signature it produces verifies under that derived public half in the exact encoding WW2 uses.
 *
 * Signing a throwaway payload is the only way to prove the key is actually *usable* rather than
 * merely well-formed, and a self-check like this reveals nothing: the payload is fixed and public,
 * and a signature over public data under a public-verifiable key discloses no secret.
 */
function inspectSigningKey(label: string, pem: string | null, checks: PreflightCheck[]): boolean {
  if (!pem) {
    checks.push({ name: `${label}: present`, status: 'absent', detail: 'not set' })
    return false
  }
  checks.push({ name: `${label}: present`, status: 'pass', detail: 'set' })

  let privateKey: KeyObject
  try {
    privateKey = createPrivateKey(pem)
  } catch {
    // Deliberately not echoing the parser's message: it can quote the malformed input.
    checks.push({ name: `${label}: parses`, status: 'fail', detail: 'not a readable private key' })
    return false
  }
  checks.push({ name: `${label}: parses`, status: 'pass', detail: `type ${privateKey.asymmetricKeyType}` })

  const curve = curveOf(privateKey)
  const isP256 = privateKey.asymmetricKeyType === 'ec' && (curve === 'prime256v1' || curve === 'P-256')
  checks.push({
    name: `${label}: curve is P-256`,
    status: isP256 ? 'pass' : 'fail',
    detail: isP256 ? 'prime256v1' : `expected prime256v1, found ${curve ?? privateKey.asymmetricKeyType}`,
  })
  if (!isP256) return false

  let publicKey: KeyObject
  try {
    publicKey = createPublicKey(privateKey)
  } catch {
    checks.push({ name: `${label}: public key derives`, status: 'fail', detail: 'derivation failed' })
    return false
  }
  checks.push({
    name: `${label}: public key derives`,
    status: 'pass',
    detail: publicKeyFingerprint(publicKey),
  })

  const payload = Buffer.from(`wewed.wedding-day.preflight.${label}`, 'utf8')
  let signature: Buffer
  try {
    signature = cryptoSign('sha256', payload, { key: privateKey, dsaEncoding: 'ieee-p1363' })
  } catch {
    checks.push({ name: `${label}: signs`, status: 'fail', detail: 'signing failed' })
    return false
  }

  // IEEE-P1363 for P-256 is r||s, two 32-byte integers: 64 bytes, 128 hex characters. A DER
  // signature would be variable-length and ~70 bytes, so this length check is what distinguishes
  // the encoding WW2 verifiers expect from the one Node produces by default.
  const correctEncoding = signature.length === 64
  checks.push({
    name: `${label}: signature is IEEE-P1363`,
    status: correctEncoding ? 'pass' : 'fail',
    detail: `${signature.length} bytes / ${signature.length * 2} hex (expected 64 / 128)`,
  })

  const verified = cryptoVerify('sha256', payload, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)
  checks.push({
    name: `${label}: derived public key verifies its own signature`,
    status: verified ? 'pass' : 'fail',
    detail: verified ? 'verified' : 'verification failed',
  })

  return correctEncoding && verified
}

export function weddingDayKeyPreflight(
  env: NodeJS.ProcessEnv = process.env,
): KeyPreflightReport {
  const checks: PreflightCheck[] = []

  const ww2Ok = inspectSigningKey('WW2 pass key', normalizePem(env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM), checks)
  const ww2KeyId = env.WEDDING_DAY_WW2_KEY_ID?.trim()
  checks.push({
    name: 'WEDDING_DAY_WW2_KEY_ID',
    status: ww2KeyId ? 'pass' : 'absent',
    detail: ww2KeyId ? ww2KeyId : 'not set',
  })

  const rootOk = inspectSigningKey('Root manifest key', normalizePem(env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM), checks)
  const rootKeyId = env.WEDDING_DAY_ROOT_KEY_ID?.trim()
  checks.push({
    name: 'WEDDING_DAY_ROOT_KEY_ID',
    status: rootKeyId ? 'pass' : 'absent',
    detail: rootKeyId ? rootKeyId : 'not set',
  })

  const ww2Pem = normalizePem(env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM)
  const rootPem = normalizePem(env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM)
  if (ww2Ok && rootOk && ww2Pem && rootPem) {
    const distinct =
      publicKeyFingerprint(createPublicKey(createPrivateKey(ww2Pem))) !==
      publicKeyFingerprint(createPublicKey(createPrivateKey(rootPem)))
    checks.push({
      name: 'WW2 and root keys are distinct',
      status: distinct ? 'pass' : 'fail',
      detail: distinct ? 'independent keys' : 'the same key is configured for both roles',
    })
  }

  return {
    ok: checks.every((check) => check.status === 'pass'),
    checks,
  }
}

/** Human-readable, and safe to paste anywhere the operator can paste. */
export function formatKeyPreflightReport(report: KeyPreflightReport): string {
  const symbol: Record<CheckStatus, string> = { pass: 'PASS  ', fail: 'FAIL  ', absent: 'ABSENT' }
  const lines = report.checks.map((c) => `  ${symbol[c.status]}  ${c.name} — ${c.detail}`)
  return [
    'Wedding Day signing-key preflight',
    '(no private key material is read back, logged or printed by this check)',
    '',
    ...lines,
    '',
    report.ok
      ? 'RESULT: all checks passed.'
      : 'RESULT: not ready — resolve every FAIL/ABSENT above before enabling Wedding Day.',
  ].join('\n')
}
