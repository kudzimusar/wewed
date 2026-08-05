import { describe, expect, test } from 'bun:test'
import { generatePreview } from './import-engine/preview'
import { parseFile } from './import-engine/parser'
import { generateTemplate } from './import-engine/template'
import { readZipEntries } from './import-engine/open-xml-workbook'
import { getWorksheetSchema } from './import-engine/schema-resolver'
import type { ModuleKey, ParsedFile } from './import-engine/types'

const EXPECTED_FIELDS: Record<string, string[]> = {
  checklist: ['Task ID', 'Task', 'Category', 'Description', 'Assigned Person', 'Due Date', 'Priority', 'Status', 'Order'],
  vendors: ['Vendor ID', 'Vendor Name', 'Category', 'Description', 'Contact', 'Phone', 'Website', 'Contract Status', 'Payment Status', 'Rating', 'Notes', 'Featured'],
  budget: ['Budget Item ID', 'Category', 'Description', 'Estimated Cost', 'Actual Cost', 'Paid Amount', 'Currency', 'Vendor ID', 'Vendor', 'Notes', 'Due Date'],
  timeline: ['Timeline Item ID', 'Time', 'Activity', 'Description', 'Duration', 'Location', 'Icon', 'Order'],
  seating: ['Guest ID', 'Guest Name', 'Table ID', 'Table Name', 'Table Capacity'],
}

const MODULES = Object.keys(EXPECTED_FIELDS) as ModuleKey[]
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function parsed(rows: Record<string, string>[], formulaCells: ParsedFile['formulaCells'] = []): ParsedFile {
  return {
    headers: Object.keys(rows[0] ?? {}),
    rows,
    rowNumbers: rows.map((_row, index) => index + 2),
    formulaCells,
    rawRowCount: rows.length + 1,
    firstSheetName: 'Template',
  }
}

describe('Planner worksheet recovery contract', () => {
  test('v1.1 templates expose only durable planner fields and remain blank/import-safe', async () => {
    for (const moduleKey of MODULES) {
      const schema = getWorksheetSchema(moduleKey)
      expect(schema.version).toBe('1.1.0')
      expect(schema.fields.map((field) => field.label)).toEqual(EXPECTED_FIELDS[moduleKey])

      const buffer = generateTemplate(schema)
      const workbook = await parseFile(buffer, XLSX_MIME)
      expect(workbook.firstSheetName).toBe('Template')
      expect(workbook.headers).toEqual(EXPECTED_FIELDS[moduleKey])
      expect(workbook.rows).toHaveLength(0)
      expect(workbook.formulaCells).toHaveLength(0)

      const entries = readZipEntries(buffer)
      const sheet = entries.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? ''
      const table = entries.get('xl/tables/table1.xml')?.toString('utf8') ?? ''
      expect(sheet).toContain('state="frozen"')
      expect(sheet).toContain('<sheetProtection')
      expect(sheet).toContain('<dataValidations')
      expect(sheet).toContain('<autoFilter')
      expect(table).toContain('<tableColumns')
    }
  })

  test('formula metadata survives preview storage and adjusted mapping reconstruction', async () => {
    const base = getWorksheetSchema('checklist')
    const schema = {
      ...base,
      fetchExisting: async () => [],
      validateReferences: undefined,
    }
    const source = parsed([
      {
        Task: 'Formula-safe task',
        Category: 'venue',
        Description: '',
      },
    ], [{ rowIndex: 2, column: 'Description', address: 'D2' }])

    const preview = await generatePreview(source, schema, 'wedding-a', 'formula.xlsx')
    expect(preview.rows[0].action).toBe('invalid')
    expect(preview.rows[0].errors.join(' ')).toContain('Formula detected')
    expect(preview.sourceFormulaCells).toEqual(source.formulaCells)
    expect(preview.sourceRowNumbers).toEqual([2])

    const rebuilt = await generatePreview({
      headers: preview.sourceHeaders!,
      rows: preview.sourceRowNumbers!.map((rowNumber) => preview.rows.find((row) => row.rowIndex === rowNumber)?.raw ?? {}),
      rowNumbers: preview.sourceRowNumbers,
      formulaCells: preview.sourceFormulaCells,
      rawRowCount: preview.sourceRawRowCount!,
      firstSheetName: preview.sourceFirstSheetName,
    }, schema, 'wedding-a', 'formula.xlsx', { Description: 'description' })
    expect(rebuilt.rows[0].action).toBe('invalid')
    expect(rebuilt.rows[0].errors.join(' ')).toContain('D2')
  })

  test('two differently identified rows cannot update one existing record', async () => {
    const base = getWorksheetSchema('checklist')
    const existing = {
      id: 'task-1',
      title: 'Same task',
      category: 'venue',
      description: null,
      assignee: null,
      dueDate: null,
      priority: 'medium',
      status: 'todo',
      order: 1,
    }
    const schema = {
      ...base,
      fetchExisting: async () => [existing],
    }
    const preview = await generatePreview(parsed([
      { 'Task ID': 'task-1', Task: 'Same task', Category: 'venue', Status: 'done' },
      { 'Task ID': '', Task: 'Same task', Category: 'venue', Status: 'blocked' },
    ]), schema, 'wedding-a', 'collision.xlsx')

    expect(preview.rows[0].action).toBe('update')
    expect(preview.rows[1].action).toBe('invalid')
    expect(preview.rows[1].errors.join(' ')).toContain('already targets this existing record')
  })

  test('removed transient metadata columns cannot silently return', () => {
    const prohibited: Record<string, string[]> = {
      checklist: ['Dependency', 'Completion %', 'Notes'],
      vendors: ['Email', 'Social Media', 'Quoted Price', 'Deposit Paid', 'Balance', 'Payment Deadline', 'Service Status', 'Responsible Person'],
      budget: ['Item/Service', 'Quoted Amount', 'Balance Remaining', 'Payment Status', 'Responsible Person'],
      timeline: ['Date', 'Start Time', 'End Time', 'Responsible Person', 'Participants', 'Vendor Involved', 'Status', 'Guest-Facing Visibility', 'Internal Notes'],
      seating: ['Seating Record ID', 'Guest Group', 'Seat Number', 'Relationship', 'Dietary Notes', 'Accessibility Notes', 'Seating Restrictions', 'Internal Notes'],
    }
    for (const moduleKey of MODULES) {
      const labels = new Set(getWorksheetSchema(moduleKey).fields.map((field) => field.label))
      for (const label of prohibited[moduleKey]) expect(labels.has(label)).toBe(false)
    }
  })
})
