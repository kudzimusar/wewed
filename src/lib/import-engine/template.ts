/**
 * wewed — Import/Export Engine — Template Generator
 * ============================================================
 * Generates a downloadable .xlsx template for a given module.
 *
 * The workbook has THREE sheets:
 *   1. "Template"  — header row + 1 example row. The user fills
 *                    this in and re-uploads it.
 *   2. "Instructions" — every field: label, key, type, required,
 *                       allowed values, description, example.
 *   3. "About"     — module name, version, generated-at, security
 *                       notes ("don't paste formulas").
 *
 * SECURITY:
 *  - Example values are prefixed with a leading apostrophe ('="…"')
 *    is NOT used because we force every cell to be a string via
 *    `t: 's'`. Excel will treat them as text, not formulas.
 *  - We never copy user input into the template — only static
 *    schema-defined examples.
 */

import * as XLSX from 'xlsx'
import type { ModuleSchema } from './types'

/** Build the example row aligned to schema.fields order. */
function buildExampleRow(schema: ModuleSchema): string[] {
  return schema.fields.map((f) => f.example ?? '')
}

/** Build the instructions sheet rows. */
function buildInstructionsRows(schema: ModuleSchema): string[][] {
  const header = [
    'Field Label',
    'Internal Key',
    'Type',
    'Required',
    'Allowed Values',
    'Sensitive',
    'Description',
    'Example',
  ]
  const rows = schema.fields.map((f) => [
    f.label,
    f.key,
    f.type,
    f.required ? 'Yes' : 'No',
    f.allowedValues ? f.allowedValues.join(', ') : '',
    f.sensitive ? 'Yes' : 'No',
    f.description ?? '',
    f.example ?? '',
  ])
  return [header, ...rows]
}

/**
 * Generate an .xlsx template buffer for the given module.
 */
export function generateTemplate(schema: ModuleSchema): Buffer {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Template ─────────────────────────────────────────
  const headerRow = schema.fields.map((f) => f.label)
  const exampleRow = buildExampleRow(schema)
  const templateAoA = [headerRow, exampleRow]
  const wsTemplate = XLSX.utils.aoa_to_sheet(templateAoA)

  // Force every cell to be a string (text) — prevents Excel from
  // auto-converting examples like "Yes" to TRUE or interpreting
  // "+263 77 123" as a formula.
  for (const addr of Object.keys(wsTemplate)) {
    if (addr.startsWith('!')) continue
    const cell = wsTemplate[addr]
    if (cell && cell.v != null) {
      cell.t = 's'
      cell.v = String(cell.v)
      delete cell.w
    }
  }

  // Column widths — generous so labels are readable.
  wsTemplate['!cols'] = schema.fields.map((f) => ({
    wch: Math.max(14, Math.min(40, (f.example ?? f.label).length + 4)),
  }))

  // Freeze the header row + first column.
  wsTemplate['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template')

  // ── Sheet 2: Instructions ─────────────────────────────────────
  const instrAoA = buildInstructionsRows(schema)
  const wsInstr = XLSX.utils.aoa_to_sheet(instrAoA)
  wsInstr['!cols'] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 32 },
    { wch: 10 },
    { wch: 48 },
    { wch: 24 },
  ]
  // Bold the header row by setting a style. Note: xlsx community
  // build doesn't persist cell styles reliably, but we set it
  // anyway — Excel will at least show the row.
  for (let c = 0; c < instrAoA[0].length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsInstr[addr]) {
      wsInstr[addr].s = { font: { bold: true } }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions')

  // ── Sheet 3: About ────────────────────────────────────────────
  const aboutAoA: string[][] = [
    ['wewed — Import Template'],
    [''],
    ['Module', schema.name],
    ['Module Key', schema.key],
    ['Template Version', schema.version],
    ['Description', schema.description],
    ['Generated At', new Date().toISOString()],
    [''],
    ['SECURITY NOTES'],
    ['• Treat every cell as untrusted input.'],
    ['• Do not paste formulas — they will be ignored on import.'],
    ['• Sensitive fields (marked Yes on Instructions) contain PII — handle with care.'],
    ['• Empty rows are skipped automatically.'],
    ['• The first row must be the header row — do not insert blank rows above it.'],
    [''],
    ['HOW TO USE'],
    [`1. Fill in the "Template" sheet with your ${schema.name.toLowerCase()} data.`],
    ['2. Save the file as .xlsx or .csv.'],
    [`3. Upload it via the ${schema.name} import button in the planner.`],
    ['4. Review the preview — confirm row actions (create/update/skip).'],
    ['5. Execute the import. Save the rollback token in case you need to undo.'],
  ]
  const wsAbout = XLSX.utils.aoa_to_sheet(aboutAoA)
  wsAbout['!cols'] = [{ wch: 20 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsAbout, 'About')

  // Write to a buffer (Node) — book_new returns a CFB container,
  // XLSX.write with type:'buffer' gives a Node Buffer.
  const out = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    bookSST: false,
    compression: true,
  })
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}
