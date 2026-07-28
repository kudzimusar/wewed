/**
 * wewed — Import/Export Engine — Row Validator
 * ============================================================
 * Validates a single mapped row against the schema:
 *  - required fields present
 *  - type checks (number, currency, date, email, phone, enum, boolean)
 *  - allowed enum values
 *  - sensitive-field warnings (PII flag)
 *
 * Returns { errors, warnings }. Errors block import; warnings don't.
 */

import type { ModuleSchema } from './types'

// Reused inline parsers — kept here to avoid coupling validator to schemas.
function clean(v: string | undefined | null): string {
  if (v == null) return ''
  return String(v).replace(/\u0000/g, '').trim()
}

function parseNumber(v: string): number | null {
  const s = clean(v).replace(/[$€£¥₹\s,]/g, '').replace(/[A-Z]{3}$/i, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseDate(v: string): Date | null {
  const s = clean(v)
  if (!s) return null
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const ms = Math.round((Number(s) - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d
  }
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let [, a, b, y] = m
    let year = Number(y)
    if (year < 100) year += year < 50 ? 2000 : 1900
    const day = Number(a)
    const month = Number(b)
    let d: Date
    if (day > 12) d = new Date(year, month - 1, day)
    else if (month > 12) d = new Date(year, day - 1, month)
    else d = new Date(year, month - 1, day)
    if (!Number.isNaN(d.getTime())) return d
  }
  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Permissive: accepts +263 77 123 4567, (212) 555-0100, 0771-234-567
const PHONE_RE = /^[+]?[\d\s()\-]{6,20}$/

export interface ValidationOutcome {
  errors: string[]
  warnings: string[]
}

/**
 * Validate a single mapped row against the schema.
 * `row` is keyed by internal field keys (already mapped).
 */
export function validateRow(
  row: Record<string, string>,
  schema: ModuleSchema,
): ValidationOutcome {
  const errors: string[] = []
  const warnings: string[] = []

  for (const field of schema.fields) {
    const raw = row[field.key]
    const v = clean(raw)

    // Required check
    if (field.required && !v) {
      errors.push(`"${field.label}" is required`)
      continue
    }

    // If empty and not required, skip type check.
    if (!v) continue

    // Type checks
    switch (field.type) {
      case 'number': {
        if (parseNumber(v) == null) {
          errors.push(`"${field.label}" must be a number (got "${v}")`)
        }
        break
      }
      case 'currency': {
        if (parseNumber(v) == null) {
          errors.push(`"${field.label}" must be a currency amount (got "${v}")`)
        }
        break
      }
      case 'date': {
        if (parseDate(v) == null) {
          errors.push(`"${field.label}" is not a valid date (got "${v}")`)
        }
        break
      }
      case 'email': {
        if (!EMAIL_RE.test(v)) {
          errors.push(`"${field.label}" is not a valid email (got "${v}")`)
        }
        break
      }
      case 'phone': {
        if (!PHONE_RE.test(v)) {
          errors.push(`"${field.label}" is not a valid phone number (got "${v}")`)
        }
        break
      }
      case 'enum': {
        const allowed = field.allowedValues ?? []
        if (allowed.length > 0 && !allowed.includes(v)) {
          errors.push(
            `"${field.label}" must be one of: ${allowed.join(', ')} (got "${v}")`,
          )
        }
        break
      }
      case 'boolean': {
        // Permissive — any yes/no/true/false/1/0/x/✓
        const ok = ['yes', 'no', 'y', 'n', 'true', 'false', '1', '0', 'x', '✓', 'confirmed'].includes(
          v.toLowerCase(),
        )
        if (!ok) {
          errors.push(
            `"${field.label}" must be Yes/No, true/false, or 1/0 (got "${v}")`,
          )
        }
        break
      }
      case 'string':
      default:
        // No type constraint
        break
    }

    // Sensitive data warning — non-blocking, but flagged
    if (field.sensitive && v) {
      warnings.push(`"${field.label}" contains private data — handle with care`)
    }

    // Length sanity
    if (v.length > 4096) {
      warnings.push(`"${field.label}" exceeds 4096 chars and will be truncated`)
    }
  }

  // Run the schema's own custom validations too (cross-field, business rules)
  if (typeof schema.validateRow === 'function') {
    try {
      const custom = schema.validateRow(row)
      if (Array.isArray(custom)) errors.push(...custom)
    } catch (err) {
      errors.push(
        `Internal validation error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { errors, warnings }
}

/**
 * Validate a batch of mapped rows. Returns the per-row outcomes.
 * Cheaper than calling validateRow individually because we re-use
 * the schema lookup, but linear either way.
 */
export function validateRows(
  rows: Record<string, string>[],
  schema: ModuleSchema,
): ValidationOutcome[] {
  return rows.map((r) => validateRow(r, schema))
}
