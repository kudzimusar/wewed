/**
 * wewed — Import/Export Engine — Field Mapper
 * ============================================================
 * Maps spreadsheet columns (e.g. "First Name", "first_name",
 * "firstName", "First name") to internal schema field keys
 * (e.g. "firstName").
 *
 * Strategy: normalize both sides (lowercase, strip non-alphanumeric,
 * collapse whitespace) then match on:
 *   1. exact normalized match against field.key
 *   2. exact normalized match against field.label
 *   3. normalized field.key is a substring of the column (or vice versa)
 *   4. token-overlap heuristic (Levenshtein-ish fallback)
 *
 * Returns the FULL mapping (including unmapped columns → '') from
 * `autoMap`. Use `applyMapping` to produce renamed rows.
 */

import type { ModuleSchema } from './types'

/** Lowercase + strip non-alphanumeric, collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Tokenize a string into normalized words. */
function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean)
}

/** Tiny Levenshtein for fuzzy fallback. */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  return dp[m][n]
}

/**
 * Score how well a header matches a field. Higher = better.
 * - 100 = exact normalized key match
 * - 95  = exact normalized label match
 * - 85  = key contains header (or vice versa)
 * - 75  = label contains header (or vice versa)
 * - 60  = high token overlap (≥2 tokens, ≥50% overlap)
 * - 0-50 = inverse Levenshtein distance (only if length ≥4)
 */
function scoreMatch(header: string, field: { key: string; label: string }): number {
  const h = normalize(header)
  if (!h) return 0
  const k = normalize(field.key)
  const l = normalize(field.label)

  if (h === k) return 100
  if (h === l) return 95
  if (k.length >= 3 && (h.includes(k) || k.includes(h))) return 85
  if (l.length >= 3 && (h.includes(l) || l.includes(h))) return 75

  const hTokens = new Set(tokenize(header))
  const lTokens = new Set(tokenize(field.label))
  if (hTokens.size >= 2 && lTokens.size >= 2) {
    let overlap = 0
    hTokens.forEach((t) => {
      if (lTokens.has(t)) overlap++
    })
    const ratio = overlap / Math.max(hTokens.size, lTokens.size)
    if (ratio >= 0.5) return 60 + Math.round(ratio * 10)
  }

  // Levenshtein fallback — only for strings ≥4 chars to avoid noise.
  if (h.length >= 4 && k.length >= 4) {
    const distK = levenshtein(h, k)
    const maxLenK = Math.max(h.length, k.length)
    const similarityK = 1 - distK / maxLenK
    if (similarityK >= 0.8) return Math.round(similarityK * 50)
  }
  if (h.length >= 4 && l.length >= 4) {
    const distL = levenshtein(h, l)
    const maxLenL = Math.max(h.length, l.length)
    const similarityL = 1 - distL / maxLenL
    if (similarityL >= 0.8) return Math.round(similarityL * 50)
  }

  return 0
}

/**
 * Auto-map source headers to internal field keys.
 * Returns a Record<sourceColumn, fieldKey | ''> — empty string
 * means "unmapped". Source columns with no good match are still
 * included with empty-string values so the preview can show them
 * under "unmapped columns".
 */
export function autoMap(
  headers: string[],
  schema: ModuleSchema,
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const usedFields = new Set<string>()

  // First pass: collect all (header, field, score) triples above threshold.
  const candidates: Array<{ header: string; fieldKey: string; score: number }> = []
  for (const header of headers) {
    for (const field of schema.fields) {
      const score = scoreMatch(header, field)
      if (score >= 50) {
        candidates.push({ header, fieldKey: field.key, score })
      }
    }
  }

  // Greedy assignment: highest-scoring (header, field) pairs first.
  // A field can only be claimed once; a header can only be claimed once.
  candidates.sort((a, b) => b.score - a.score)
  for (const c of candidates) {
    if (usedFields.has(c.fieldKey)) continue
    if (mapping[c.header]) continue
    mapping[c.header] = c.fieldKey
    usedFields.add(c.fieldKey)
  }

  // Ensure every header appears in the mapping output (even unmapped ones).
  for (const header of headers) {
    if (!(header in mapping)) mapping[header] = ''
  }

  return mapping
}

/**
 * Apply a mapping to a list of rows: rename keys per the mapping,
 * drop unmapped keys, and convert all values to strings.
 *
 * `mapping` should be Record<sourceColumn, fieldKey | ''>.
 */
export function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const [srcCol, fieldKey] of Object.entries(mapping)) {
      if (!fieldKey) continue
      const v = row[srcCol]
      if (v != null) {
        mapped[fieldKey] = String(v)
      } else if (!(fieldKey in mapped)) {
        mapped[fieldKey] = ''
      }
    }
    return mapped
  })
}

/**
 * Return the list of source columns that the schema requires but
 * which were not mapped to any field. Used for the preview's
 * `missingRequired` field — helps the user spot missing columns
 * before they execute the import.
 */
export function findMissingRequired(
  schema: ModuleSchema,
  mapping: Record<string, string>,
): string[] {
  const mappedFields = new Set(Object.values(mapping).filter(Boolean))
  return schema.fields
    .filter((f) => f.required && !mappedFields.has(f.key))
    .map((f) => f.label)
}

/**
 * Return the list of source columns that didn't map to any field.
 */
export function findUnmappedColumns(
  headers: string[],
  mapping: Record<string, string>,
): string[] {
  return headers.filter((h) => !mapping[h])
}
