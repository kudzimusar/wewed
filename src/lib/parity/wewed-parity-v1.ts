/**
 * wewed.parity.v1 — machine-readable live parity contract (Plan
 * WW-P13-LIVE-DATA-GUEST-CONVERGENCE-2026-09-26-01, QRO 01 §13–§14).
 *
 * A parity *run* holds one record per (actor label, client). Each record states what that client
 * resolved for that actor from the real backend. The checker proves the clients are presentations
 * of ONE authority: for every label, every authority field must be byte-identical across clients.
 *
 * Authority is identifiers, never labels. Human-readable values that must also agree (Guest name,
 * couple names, venue, authored invitation message, wedding title) travel only as SHA-256 digests
 * of their normalized text, so a receipt can prove equality without publishing personal data, and
 * the checker can name the dangerous case exactly: the display matches but the ID does not.
 *
 * Secrets never enter a record. The Wedding Pass is compared as SHA-256(WeddingPassCredential.token);
 * a record carrying anything token-, cookie-, password- or bypass-shaped is refused outright.
 *
 * Pure module: no server, database or network dependency, so the same checker runs in CI, on a
 * qualifier's machine and in the moderator's review.
 */

import { createHash } from 'node:crypto'

export const WEWED_PARITY_CONTRACT = 'wewed.parity.v1'

export const PARITY_CLIENTS = ['backend', 'desktop', 'ios', 'android'] as const
export type ParityClient = (typeof PARITY_CLIENTS)[number]

export const PARITY_ROLES = ['guest', 'couple', 'planner', 'coordinator', 'vendor', 'gate', 'admin'] as const
export type ParityRole = (typeof PARITY_ROLES)[number]

export const PARITY_RSVP_STATUSES = ['pending', 'attending', 'declined'] as const
export type ParityRsvpStatus = (typeof PARITY_RSVP_STATUSES)[number]

/** Mirrors WeddingPassAvailabilityState (src/lib/wedding-pass-availability.ts). */
export const PARITY_PASS_STATES = [
  'rsvp_required',
  'declined',
  'not_yet_issuable',
  'active',
  'issuance_closed',
  'revoked',
] as const
export type ParityPassState = (typeof PARITY_PASS_STATES)[number]

const SHA256_HEX = /^[0-9a-f]{64}$/

export interface WewedParityRecordV1 {
  contract: typeof WEWED_PARITY_CONTRACT
  /** Anonymized actor label, e.g. `G`, `CA`, `P`, `C`, `V`, `U`, `ADM`. Never a name or email. */
  label: string
  role: ParityRole
  client: ParityClient
  /** Origin the client talked to (https://wewed.pro or the allowlisted Preview origin). */
  baseUrl: string
  /** Source commit the client was built from / the backend deployment served. */
  commitSha: string

  // Account axis (null for `guest`: a Guest is invitation-bound, never an account workspace).
  accessUserId: string | null
  grantId: string | null
  membershipRole: string | null
  permissions: string[] | null

  // Wedding axis.
  weddingId: string | null
  coupleId: string | null
  weddingDate: string | null
  weddingTitleDigest: string | null
  coupleNamesDigest: string | null
  venueDigest: string | null

  // Business / vendor axis.
  businessAccountId: string | null
  vendorId: string | null
  serviceEngagementId: string | null

  // Guest axis.
  guestId: string | null
  guestNameDigest: string | null
  rsvpStatus: ParityRsvpStatus | null
  partySize: number | null
  tableId: string | null
  mealChoice: string | null
  invitationStyle: string | null
  invitationMessageDigest: string | null

  // Wedding Pass (credential state only; arrival is a separate dimension).
  passAvailability: ParityPassState | null
  passSerial: string | null
  /** SHA-256 hex of the exact active WeddingPassCredential.token. Never the token itself. */
  passDigest: string | null

  // Gate operational axis.
  gateGrantId: string | null
  gateId: string | null
  capabilities: string[] | null
}

export interface WewedParityRunV1 {
  contract: typeof WEWED_PARITY_CONTRACT
  runId: string
  /** Every label must be observed by every one of these clients. */
  requiredClients: ParityClient[]
  /** Labels that must all resolve the same weddingId (e.g. CA, P, C and G on the UAT wedding). */
  sameWeddingLabels?: string[]
  records: WewedParityRecordV1[]
}

export type ParityFailureCode =
  | 'CONTRACT_INVALID'
  | 'RECORD_INVALID'
  | 'SECRET_MATERIAL'
  | 'DUPLICATE_RECORD'
  | 'CLIENT_MISSING'
  | 'REQUIRED_FIELD_MISSING'
  | 'FIELD_MISMATCH'
  | 'LABEL_MATCH_ID_MISMATCH'
  | 'PASS_DIGEST_REQUIRED'
  | 'PASS_DIGEST_FORBIDDEN'
  | 'CROSS_LABEL_WEDDING_MISMATCH'

export interface ParityFailure {
  code: ParityFailureCode
  label?: string
  field?: string
  message: string
}

export interface ParityCheckResult {
  ok: boolean
  failures: ParityFailure[]
  /** label → client list actually compared */
  compared: Record<string, ParityClient[]>
}

/** Normalizes human text before digesting so presentation-only whitespace/case never differs. */
export function parityTextDigest(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  if (!normalized) return null
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/** SHA-256 of the exact bearer credential bytes. The raw token must never be persisted. */
export function passTokenDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

type Field = keyof WewedParityRecordV1

const ID_FIELDS: Field[] = [
  'accessUserId', 'grantId', 'weddingId', 'coupleId', 'businessAccountId', 'vendorId',
  'serviceEngagementId', 'guestId', 'tableId', 'passSerial', 'passDigest', 'gateGrantId', 'gateId',
]

/**
 * Fields each role must resolve (non-null) on every client. Fields not listed for a role must be
 * null when inapplicable — `null` means "semantically inapplicable", never "unknown".
 */
const REQUIRED_BY_ROLE: Record<ParityRole, Field[]> = {
  guest: ['weddingId', 'weddingDate', 'weddingTitleDigest', 'guestId', 'guestNameDigest', 'rsvpStatus',
    'partySize', 'invitationStyle', 'passAvailability'],
  couple: ['accessUserId', 'grantId', 'membershipRole', 'permissions', 'weddingId', 'coupleId', 'weddingDate'],
  planner: ['accessUserId', 'grantId', 'membershipRole', 'permissions', 'weddingId', 'coupleId', 'weddingDate'],
  coordinator: ['accessUserId', 'grantId', 'membershipRole', 'permissions', 'weddingId', 'coupleId', 'weddingDate'],
  vendor: ['accessUserId', 'grantId', 'businessAccountId'],
  gate: ['accessUserId', 'weddingId', 'gateGrantId', 'gateId', 'capabilities'],
  admin: ['accessUserId', 'grantId', 'permissions'],
}

/** Every authority field is compared across clients for a label. */
const COMPARED_FIELDS: Field[] = [
  'role', 'accessUserId', 'grantId', 'membershipRole', 'permissions', 'weddingId', 'coupleId',
  'weddingDate', 'weddingTitleDigest', 'coupleNamesDigest', 'venueDigest', 'businessAccountId',
  'vendorId', 'serviceEngagementId', 'guestId', 'guestNameDigest', 'rsvpStatus', 'partySize',
  'tableId', 'mealChoice', 'invitationStyle', 'invitationMessageDigest', 'passAvailability',
  'passSerial', 'passDigest', 'gateGrantId', 'gateId', 'capabilities',
]

/** Display digests paired with the identifier they describe. */
const DISPLAY_TO_ID: Array<[Field, Field]> = [
  ['weddingTitleDigest', 'weddingId'],
  ['coupleNamesDigest', 'weddingId'],
  ['guestNameDigest', 'guestId'],
]

const ALL_FIELDS: Field[] = [
  'contract', 'label', 'role', 'client', 'baseUrl', 'commitSha', ...COMPARED_FIELDS.filter((f) => f !== 'role'),
]

const FORBIDDEN_KEY = /token|cookie|password|passwd|secret|bypass|authorization|session|privatekey|pem/i
const SECRET_VALUE = [
  /^WW2\./, // raw WW2 credential
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /wewed_(admin_auth|wedding_guest)=/, // session cookie material
  /[?&]rsvp=/, // private invitation link
]

function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort())
  return JSON.stringify(value ?? null)
}

function scanForSecrets(record: Record<string, unknown>): string[] {
  const problems: string[] = []
  for (const [key, value] of Object.entries(record)) {
    if (FORBIDDEN_KEY.test(key)) problems.push(`key "${key}"`)
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (typeof item === 'string' && SECRET_VALUE.some((pattern) => pattern.test(item))) {
        problems.push(`value of "${key}"`)
      }
    }
  }
  return problems
}

function validateRecord(raw: unknown, index: number): { record?: WewedParityRecordV1; failures: ParityFailure[] } {
  const failures: ParityFailure[] = []
  const fail = (message: string, field?: string) =>
    failures.push({ code: 'RECORD_INVALID', field, message: `records[${index}]: ${message}` })
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('not an object')
    return { failures }
  }
  const r = raw as Record<string, unknown>
  const secrets = scanForSecrets(r)
  if (secrets.length) {
    failures.push({
      code: 'SECRET_MATERIAL',
      label: typeof r.label === 'string' ? r.label : undefined,
      message: `records[${index}] carries secret-shaped material (${secrets.join(', ')}); records may hold digests only`,
    })
    return { failures }
  }
  for (const key of Object.keys(r)) if (!ALL_FIELDS.includes(key as Field)) fail(`unknown field "${key}"`, key)
  for (const key of ALL_FIELDS) if (!(key in r)) fail(`missing field "${key}" (use null when inapplicable)`, key)
  if (r.contract !== WEWED_PARITY_CONTRACT) fail(`contract must be ${WEWED_PARITY_CONTRACT}`, 'contract')
  if (typeof r.label !== 'string' || !/^[A-Z][A-Z0-9_-]{0,15}$/.test(r.label)) fail('label must be an anonymized code like G or CA', 'label')
  if (!PARITY_ROLES.includes(r.role as ParityRole)) fail('invalid role', 'role')
  if (!PARITY_CLIENTS.includes(r.client as ParityClient)) fail('invalid client', 'client')
  if (typeof r.baseUrl !== 'string' || !/^https?:\/\/[^/?#]+$/.test(r.baseUrl)) fail('baseUrl must be a bare origin', 'baseUrl')
  if (typeof r.commitSha !== 'string' || !/^[0-9a-f]{7,40}$/.test(r.commitSha)) fail('commitSha must be a git SHA', 'commitSha')
  for (const f of ID_FIELDS) {
    const v = r[f]
    if (v !== null && (typeof v !== 'string' || !v.trim())) fail(`${f} must be a non-empty string or null`, f)
  }
  for (const f of ['weddingTitleDigest', 'coupleNamesDigest', 'venueDigest', 'guestNameDigest', 'invitationMessageDigest', 'passDigest'] as Field[]) {
    const v = r[f]
    if (v !== null && (typeof v !== 'string' || !SHA256_HEX.test(v))) fail(`${f} must be a lowercase SHA-256 hex digest or null`, f)
  }
  for (const f of ['permissions', 'capabilities'] as Field[]) {
    const v = r[f]
    if (v !== null && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) fail(`${f} must be a string array or null`, f)
  }
  if (r.weddingDate !== null && (typeof r.weddingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.weddingDate))) {
    fail('weddingDate must be YYYY-MM-DD or null', 'weddingDate')
  }
  if (r.rsvpStatus !== null && !PARITY_RSVP_STATUSES.includes(r.rsvpStatus as ParityRsvpStatus)) fail('invalid rsvpStatus', 'rsvpStatus')
  if (r.passAvailability !== null && !PARITY_PASS_STATES.includes(r.passAvailability as ParityPassState)) fail('invalid passAvailability', 'passAvailability')
  if (r.partySize !== null && (!Number.isInteger(r.partySize) || (r.partySize as number) < 0)) fail('partySize must be a non-negative integer or null', 'partySize')
  for (const f of ['membershipRole', 'mealChoice', 'invitationStyle'] as Field[]) {
    if (r[f] !== null && typeof r[f] !== 'string') fail(`${f} must be a string or null`, f)
  }
  if (r.role === 'guest' && (r.accessUserId !== null || r.grantId !== null)) {
    fail('a Guest is invitation-bound and never carries an account identity or workspace grant', 'grantId')
  }
  return failures.length ? { failures } : { record: r as unknown as WewedParityRecordV1, failures }
}

export function checkWewedParityRun(input: unknown): ParityCheckResult {
  const failures: ParityFailure[] = []
  const compared: Record<string, ParityClient[]> = {}
  const run = input as Partial<WewedParityRunV1> | null
  if (!run || typeof run !== 'object' || run.contract !== WEWED_PARITY_CONTRACT || !Array.isArray(run.records)
    || !Array.isArray(run.requiredClients) || run.requiredClients.length < 2
    || run.requiredClients.some((c) => !PARITY_CLIENTS.includes(c))) {
    return {
      ok: false,
      compared,
      failures: [{ code: 'CONTRACT_INVALID', message: `input must be a ${WEWED_PARITY_CONTRACT} run with records[] and at least two requiredClients` }],
    }
  }

  const records: WewedParityRecordV1[] = []
  run.records.forEach((raw, index) => {
    const result = validateRecord(raw, index)
    failures.push(...result.failures)
    if (result.record) records.push(result.record)
  })

  const byLabel = new Map<string, Map<ParityClient, WewedParityRecordV1>>()
  for (const record of records) {
    const clients = byLabel.get(record.label) ?? new Map<ParityClient, WewedParityRecordV1>()
    if (clients.has(record.client)) {
      failures.push({ code: 'DUPLICATE_RECORD', label: record.label, message: `${record.label}: two ${record.client} records` })
      continue
    }
    clients.set(record.client, record)
    byLabel.set(record.label, clients)
  }

  for (const [label, clients] of [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    compared[label] = [...clients.keys()].sort()
    for (const client of run.requiredClients) {
      if (!clients.has(client)) {
        failures.push({ code: 'CLIENT_MISSING', label, message: `${label}: no ${client} record — the ${client} client did not resolve this actor` })
      }
    }
    const list = [...clients.values()]
    for (const record of list) {
      for (const field of REQUIRED_BY_ROLE[record.role] ?? []) {
        const v = record[field]
        if (v === null || (Array.isArray(v) && v.length === 0)) {
          failures.push({
            code: 'REQUIRED_FIELD_MISSING', label, field,
            message: `${label}/${record.client}: ${field} is required for role ${record.role} (grant or relationship unexpectedly missing)`,
          })
        }
      }
      if (record.passAvailability === 'active' && record.passDigest === null) {
        failures.push({ code: 'PASS_DIGEST_REQUIRED', label, field: 'passDigest', message: `${label}/${record.client}: an active Pass must carry its credential digest` })
      }
      if (record.passAvailability !== null && record.passAvailability !== 'active' && record.passDigest !== null) {
        failures.push({ code: 'PASS_DIGEST_FORBIDDEN', label, field: 'passDigest', message: `${label}/${record.client}: a ${record.passAvailability} Pass must not present a live credential digest` })
      }
    }
    if (list.length < 2) continue
    const reference = list[0]
    for (const field of COMPARED_FIELDS) {
      const values = new Map(list.map((r) => [r.client, canonical(r[field])]))
      if (new Set(values.values()).size > 1) {
        const detail = list.map((r) => `${r.client}=${canonical(r[field])}`).join(' ')
        const displayTwin = DISPLAY_TO_ID.find(([, id]) => id === field)?.[0]
        const displayAgrees = displayTwin !== undefined && list.every((r) => r[displayTwin] !== null && r[displayTwin] === reference[displayTwin])
        failures.push({
          code: displayAgrees ? 'LABEL_MATCH_ID_MISMATCH' : 'FIELD_MISMATCH',
          label,
          field,
          message: displayAgrees
            ? `${label}: ${field} differs although the displayed ${displayTwin} is identical — same-looking ${field === 'guestId' ? 'Guest' : 'wedding'}, different authority (${detail})`
            : `${label}: ${field} differs across clients (${detail})`,
        })
      }
    }
  }

  if (run.sameWeddingLabels?.length) {
    const weddings = new Map<string, string>()
    for (const label of run.sameWeddingLabels) {
      for (const record of byLabel.get(label)?.values() ?? []) {
        if (record.weddingId) weddings.set(`${label}/${record.client}`, record.weddingId)
      }
    }
    if (new Set(weddings.values()).size > 1) {
      failures.push({
        code: 'CROSS_LABEL_WEDDING_MISMATCH',
        message: `labels ${run.sameWeddingLabels.join(', ')} must resolve one wedding (${[...weddings.entries()].map(([k, v]) => `${k}=${v}`).join(' ')})`,
      })
    }
  }

  return { ok: failures.length === 0, failures, compared }
}

/** An all-null record skeleton; collectors fill the fields their role and client resolve. */
export function emptyParityRecord(
  base: Pick<WewedParityRecordV1, 'label' | 'role' | 'client' | 'baseUrl' | 'commitSha'>,
): WewedParityRecordV1 {
  return {
    contract: WEWED_PARITY_CONTRACT,
    ...base,
    accessUserId: null, grantId: null, membershipRole: null, permissions: null,
    weddingId: null, coupleId: null, weddingDate: null, weddingTitleDigest: null, coupleNamesDigest: null, venueDigest: null,
    businessAccountId: null, vendorId: null, serviceEngagementId: null,
    guestId: null, guestNameDigest: null, rsvpStatus: null, partySize: null, tableId: null, mealChoice: null,
    invitationStyle: null, invitationMessageDigest: null,
    passAvailability: null, passSerial: null, passDigest: null,
    gateGrantId: null, gateId: null, capabilities: null,
  }
}
