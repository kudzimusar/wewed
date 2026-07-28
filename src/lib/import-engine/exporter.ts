/**
 * wewed — Import/Export Engine — Data Exporter
 * ============================================================
 * Exports the current wedding's data for a given module as an
 * .xlsx or .csv buffer.
 *
 * Flow:
 *   1. Fetch all records via schema.fetchExisting(weddingId)
 *   2. Convert each to a row via schema.recordToRow
 *   3. For .xlsx: build a workbook with header + rows, force text
 *      type on every cell (prevents Excel from auto-converting
 *      phone numbers to scientific notation, etc.)
 *   4. For .csv: use json2csv (handles escaping, quoting, unicode)
 *
 * SECURITY: all values are stringified before being written to
 * the file. No formulas, no macros, no embedded objects.
 */

import * as XLSX from 'xlsx'
import { Parser as Json2CsvParser } from 'json2csv'
import type { ModuleSchema } from './types'

/**
 * Fetch records and convert to row objects keyed by field label.
 * Used by both xlsx and csv exporters so they stay in sync.
 */
async function buildExportRows(
  schema: ModuleSchema,
  weddingId: string,
): Promise<Record<string, string>[]> {
  const records = await schema.fetchExisting(weddingId)
  return records.map((rec) => {
    const row = schema.recordToRow(rec)
    // Re-key by label for human-readable headers in the export.
    const labeled: Record<string, string> = {}
    for (const field of schema.fields) {
      const v = row[field.key]
      labeled[field.label] = v == null ? '' : String(v)
    }
    return labeled
  })
}

/**
 * Export the module's data as an .xlsx or .csv buffer.
 */
export async function exportModule(
  schema: ModuleSchema,
  weddingId: string,
  format: 'xlsx' | 'csv' = 'xlsx',
): Promise<Buffer> {
  const rows = await buildExportRows(schema, weddingId)
  const headers = schema.fields.map((f) => f.label)

  if (format === 'csv') {
    return exportCsv(headers, rows)
  }
  return exportXlsx(headers, rows, schema)
}

// ============================================================
// XLSX
// ============================================================
function exportXlsx(
  headers: string[],
  rows: Record<string, string>[],
  schema: ModuleSchema,
): Buffer {
  const wb = XLSX.utils.book_new()

  // Build array-of-arrays: header row + data rows, all strings.
  const aoa: string[][] = [
    headers,
    ...rows.map((r) => headers.map((h) => (r[h] == null ? '' : String(r[h])))),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Force every cell to be a string — prevents Excel from
  // auto-converting phone numbers ("+263 77..." → number, drops
  // leading +), emails, dates, etc.
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const cell = ws[addr]
    if (cell && cell.v != null) {
      cell.t = 's'
      cell.v = String(cell.v)
      delete cell.w
    }
  }

  // Column widths based on max content length per column.
  ws['!cols'] = headers.map((h, i) => {
    const colLen = Math.max(
      h.length,
      ...rows.map((r) => (r[h] ? String(r[h]).length : 0)),
    )
    return { wch: Math.max(12, Math.min(50, colLen + 2)) }
  })

  // Freeze header row.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, schema.name.slice(0, 31))

  const out = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    bookSST: false,
    compression: true,
  })
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

// ============================================================
// CSV (json2csv)
// ============================================================
function exportCsv(
  headers: string[],
  rows: Record<string, string>[],
): Buffer {
  // json2csv needs fields spec — we want our headers in schema order.
  const fields = headers.map((h) => ({
    label: h,
    value: (row: Record<string, string>) => row[h] ?? '',
    default: '',
  }))

  const parser = new Json2CsvParser(fields, {
    defaultValue: '',
    header: true,
    eol: '\n',
    // Quote every field — safest for phone numbers, emails, etc.
    quote: '"',
    escapedQuote: '""',
  })

  const csv = parser.parse(rows)
  // Prepend a UTF-8 BOM so Excel opens Unicode characters correctly.
  return Buffer.from(`\uFEFF${csv}`, 'utf-8')
}
