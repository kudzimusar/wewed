/**
 * Parses uploaded .xlsx and .csv files into normalized string rows.
 * Spreadsheet formulas are detected explicitly, removed from the value path,
 * and returned as row/column errors for the preview layer.
 */
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { ParsedFile, ParsedFormulaCell } from './types'

const FORMULA_SENTINEL = '__WEWED_FORMULA_REJECTED__'
function sanitize(s: string): string { return s.replace(/^\uFEFF/, '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n') }
function normalizeHeader(h: string): string { return sanitize(h).replace(/\s+/g, ' ').trim() }
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()
  return headers.map((h) => { const n = seen.get(h) ?? 0; seen.set(h, n + 1); return n === 0 ? h : `${h}_${n + 1}` })
}
function isEmptyRow(cells: string[]): boolean { return cells.every((c) => sanitize(c).trim() === '') }

export async function parseFile(buffer: Buffer, mimeType: string): Promise<ParsedFile> {
  const xlsxMagic = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
  const xlsxMime = mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx')
  const csvMime = mimeType.includes('csv') || mimeType.includes('text/plain') || mimeType.includes('comma-separated')
  return xlsxMagic || (xlsxMime && !csvMime) ? parseXlsx(buffer) : parseCsv(buffer)
}

function emptyParsed(rawRowCount = 0, firstSheetName?: string): ParsedFile {
  return { headers: [], rows: [], rowNumbers: [], formulaCells: [], rawRowCount, firstSheetName }
}

function parseXlsx(buffer: Buffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: true, cellText: false, raw: false })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) return emptyParsed()
  const sheet = wb.Sheets[firstSheetName]
  const formulaAddresses: string[] = []
  for (const [address, value] of Object.entries(sheet)) {
    if (address.startsWith('!')) continue
    const cell = value as XLSX.CellObject
    if (typeof cell.f === 'string' && cell.f.trim()) {
      formulaAddresses.push(address)
      cell.t = 's'
      cell.v = FORMULA_SENTINEL
      delete cell.w
      delete cell.f
    }
  }

  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true })
  const rawRowCount = aoa.length
  if (!rawRowCount) return emptyParsed(0, firstSheetName)
  let headerIdx = 0
  while (headerIdx < aoa.length && isEmptyRow(aoa[headerIdx].map(String))) headerIdx++
  if (headerIdx >= aoa.length) return emptyParsed(rawRowCount, firstSheetName)

  const rawHeaders = aoa[headerIdx].map((h) => normalizeHeader(String(h === FORMULA_SENTINEL ? '' : h)))
  let lastNonEmpty = rawHeaders.length - 1
  while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === '') lastNonEmpty--
  const headers = dedupeHeaders(rawHeaders.slice(0, lastNonEmpty + 1))
  const formulaCells: ParsedFormulaCell[] = formulaAddresses.map((address) => {
    const decoded = XLSX.utils.decode_cell(address)
    return { rowIndex: decoded.r + 1, column: headers[decoded.c] || XLSX.utils.encode_col(decoded.c), address }
  })

  const rows: Record<string, string>[] = []
  const rowNumbers: number[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i].map((cell) => cell == null ? '' : String(cell))
    if (isEmptyRow(cells)) continue
    const row: Record<string, string> = {}
    headers.forEach((header, index) => { row[header] = cells[index] === FORMULA_SENTINEL ? '' : sanitize(cells[index] ?? '').trim() })
    rows.push(row)
    rowNumbers.push(i + 1)
  }
  return { headers, rows, rowNumbers, formulaCells, rawRowCount, firstSheetName }
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = sanitize(buffer.toString('utf-8'))
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', header: false, dynamicTyping: false })
  const aoa = (result.data as string[][]).filter(Array.isArray)
  const rawRowCount = aoa.length
  if (!rawRowCount) return emptyParsed()
  let headerIdx = 0
  while (headerIdx < aoa.length && isEmptyRow(aoa[headerIdx].map((cell) => String(cell ?? '')))) headerIdx++
  if (headerIdx >= aoa.length) return emptyParsed(rawRowCount)
  const rawHeaders = aoa[headerIdx].map((header) => normalizeHeader(String(header ?? '')))
  let lastNonEmpty = rawHeaders.length - 1
  while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === '') lastNonEmpty--
  const headers = dedupeHeaders(rawHeaders.slice(0, lastNonEmpty + 1))
  const rows: Record<string, string>[] = []
  const rowNumbers: number[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i].map((cell) => String(cell ?? ''))
    if (isEmptyRow(cells)) continue
    const row: Record<string, string> = {}
    headers.forEach((header, index) => { row[header] = sanitize(cells[index] ?? '').trim() })
    rows.push(row)
    rowNumbers.push(i + 1)
  }
  return { headers, rows, rowNumbers, formulaCells: [], rawRowCount }
}

export function fileFingerprint(parsed: ParsedFile): string {
  const sample = parsed.rows.slice(0, 5).map((row) => JSON.stringify(row)).join('|')
  const formulas = (parsed.formulaCells ?? []).map((cell) => cell.address).join(',')
  const input = `${parsed.headers.join(',')}|${parsed.rows.length}|${sample}|${formulas}`
  let h1 = 0x811c9dc5; let h2 = 0x1000193
  for (let i = 0; i < input.length; i++) { const c = input.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 0x01000193); h2 ^= c + i; h2 = Math.imul(h2, 0x1000193) }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}
