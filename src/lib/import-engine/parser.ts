/**
 * wewed — Import/Export Engine — File Parser
 * ============================================================
 * Parses uploaded .xlsx and .csv files into a normalized shape:
 *   { headers: string[], rows: Record<string,string>[] }
 *
 * SECURITY:
 *  - Reads cells as strings only — never evaluates formulas.
 *  - Strips null bytes, CR characters, and BOM.
 *  - Treats the first non-empty row as the header row.
 *  - Skips entirely empty rows.
 *  - De-duplicates header names (appends "_2", "_3", etc.).
 *
 * Performance:
 *  - For .xlsx, uses sheet_to_json with `header: 1` (array-of-arrays)
 *    so we can spot empty rows without iterating twice.
 *  - For .csv, papaparse with `header: true, skipEmptyLines: true`.
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { ParsedFile } from './types'

/** Strip BOM, null bytes, normalize line endings. */
function sanitize(s: string): string {
  return s
    .replace(/^\uFEFF/, '') // BOM
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
}

/** Trim a header name; collapse internal whitespace. */
function normalizeHeader(h: string): string {
  return sanitize(h)
    .replace(/\s+/g, ' ')
    .trim()
}

/** If a header appears more than once, append "_2", "_3", etc. */
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()
  return headers.map((h) => {
    const base = h || '' // empty headers stay empty (filtered later)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    if (n === 0) return base
    return `${base}_${n + 1}`
  })
}

/** A row is "empty" if every cell is blank after trimming. */
function isEmptyRow(cells: string[]): boolean {
  return cells.every((c) => sanitize(c).trim() === '')
}

/**
 * Parse an uploaded file. `mimeType` is used to pick the strategy,
 * but the actual detection is content-based (xlsx magic bytes vs CSV text).
 *
 * @param buffer  raw file bytes (10 MB cap enforced by the API route)
 * @param mimeType  the Content-Type from the upload (informational)
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedFile> {
  // ── Detect xlsx by magic bytes ──────────────────────────────
  // XLSX files are ZIP archives: PK\x03\x04
  const isXlsxMagic =
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  const looksXlsxByMime =
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('xlsx')
  const looksCsvByMime =
    mimeType.includes('csv') ||
    mimeType.includes('text/plain') ||
    mimeType.includes('comma-separated')

  if (isXlsxMagic || (looksXlsxByMime && !looksCsvByMime)) {
    return parseXlsx(buffer)
  }
  return parseCsv(buffer)
}

// ============================================================
// XLSX
// ============================================================
function parseXlsx(buffer: Buffer): ParsedFile {
  // Read with `cellDates: false` — we want strings, not Date objects,
  // so the validator/parser can re-interpret them. `raw: false` formats
  // every cell according to its number format string (e.g. currency).
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellNF: true,
    cellText: false,
    raw: false,
  })

  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) {
    return { headers: [], rows: [], rawRowCount: 0 }
  }
  const sheet = wb.Sheets[firstSheetName]

  // Array-of-arrays — first row = headers, rest = data
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true, // we'll filter ourselves so we can count them
  })

  const rawRowCount = aoa.length
  if (rawRowCount === 0) {
    return { headers: [], rows: [], rawRowCount: 0 }
  }

  // Find header row — skip leading completely-empty rows
  let headerIdx = 0
  while (headerIdx < aoa.length && isEmptyRow(aoa[headerIdx].map(String))) {
    headerIdx++
  }
  if (headerIdx >= aoa.length) {
    return { headers: [], rows: [], rawRowCount }
  }

  const rawHeaders = aoa[headerIdx].map((h) => normalizeHeader(String(h)))
  // Filter trailing empty headers (cells beyond the data)
  let lastNonEmpty = rawHeaders.length - 1
  while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === '') lastNonEmpty--
  const headers = dedupeHeaders(rawHeaders.slice(0, lastNonEmpty + 1))

  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i].map((c) => (c == null ? '' : String(c)))
    if (isEmptyRow(cells)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = sanitize(cells[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows, rawRowCount }
}

// ============================================================
// CSV (papaparse)
// ============================================================
function parseCsv(buffer: Buffer): ParsedFile {
  const text = sanitize(buffer.toString('utf-8'))
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy', // skip rows that are empty after trimming
    header: false, // we'll do header extraction ourselves for consistency with xlsx
    dynamicTyping: false,
    transformHeader: undefined,
  })

  const aoa = (result.data as string[][]).filter((r) => Array.isArray(r))
  const rawRowCount = aoa.length

  if (rawRowCount === 0) {
    return { headers: [], rows: [], rawRowCount: 0 }
  }

  let headerIdx = 0
  while (
    headerIdx < aoa.length &&
    isEmptyRow(aoa[headerIdx].map((c) => (c == null ? '' : String(c))))
  ) {
    headerIdx++
  }
  if (headerIdx >= aoa.length) {
    return { headers: [], rows: [], rawRowCount }
  }

  const rawHeaders = aoa[headerIdx].map((h) => normalizeHeader(String(h ?? '')))
  let lastNonEmpty = rawHeaders.length - 1
  while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === '') lastNonEmpty--
  const headers = dedupeHeaders(rawHeaders.slice(0, lastNonEmpty + 1))

  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i].map((c) => (c == null ? '' : String(c)))
    if (isEmptyRow(cells)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = sanitize(cells[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows, rawRowCount }
}

/**
 * Compute a stable fingerprint of the parsed file for job-id stability.
 * Not cryptographic — just a 16-hex hash of headers + row count + sample.
 */
export function fileFingerprint(parsed: ParsedFile): string {
  const sample = parsed.rows.slice(0, 5).map((r) => JSON.stringify(r)).join('|')
  const input = `${parsed.headers.join(',')}|${parsed.rows.length}|${sample}`
  // Simple FNV-1a 32-bit hash → 8 hex chars, doubled for 16.
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= c + i
    h2 = Math.imul(h2, 0x1000193)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return hex1 + hex2
}
