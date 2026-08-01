/** Generates an offline-safe Excel/Google Sheets import workbook. */
import * as XLSX from 'xlsx'
import type { FieldDefinition, ModuleSchema } from './types'
import { patchXlsx, readZipEntries } from './open-xml-workbook'

const DATA_ROWS = 100
function xml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;') }
function instructions(schema: ModuleSchema): string[][] {
  return [['Field Label', 'Internal Key', 'Type', 'Required', 'Allowed Values', 'Sensitive', 'Description', 'Example'], ...schema.fields.map((field) => [field.label, field.key, field.type, field.required ? 'Yes' : 'No', field.allowedValues?.join(', ') ?? '', field.sensitive ? 'Yes' : 'No', field.description ?? '', field.example ?? ''])]
}
function validation(field: FieldDefinition, column: string): string | null {
  const range = `${column}2:${column}${DATA_ROWS + 1}`
  if (field.allowedValues?.length) return `<dataValidation type="list" allowBlank="${field.required ? '0' : '1'}" showErrorMessage="1" errorTitle="Invalid value" error="Choose a value from the list." sqref="${range}"><formula1>&quot;${xml(field.allowedValues.join(','))}&quot;</formula1></dataValidation>`
  if (field.type === 'number' || field.type === 'currency') return `<dataValidation type="decimal" operator="greaterThanOrEqual" allowBlank="${field.required ? '0' : '1'}" showErrorMessage="1" errorTitle="Invalid number" error="Enter zero or a positive number." sqref="${range}"><formula1>0</formula1></dataValidation>`
  if (field.type === 'date') return `<dataValidation type="date" operator="greaterThanOrEqual" allowBlank="${field.required ? '0' : '1'}" showErrorMessage="1" errorTitle="Invalid date" error="Enter a valid date." sqref="${range}"><formula1>DATE(1900,1,1)</formula1></dataValidation>`
  return null
}
function addUnlockedStyle(styles: string): string {
  const match = styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/)
  if (!match) return styles
  const firstXf = match[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/)?.[0]
  if (!firstXf) return styles
  const unlocked = firstXf.endsWith('/>') ? firstXf.replace(/\/>$/, ' applyProtection="1"><protection locked="0"/></xf>') : firstXf.replace(/<\/xf>$/, '<protection locked="0"/></xf>').replace(/^<xf\b/, '<xf applyProtection="1"')
  styles = styles.replace(match[0], `<cellXfs count="${Number(match[1]) + 1}">${match[2]}${unlocked}</cellXfs>`)
  const dxf = '<dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFFE5E5"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>'
  if (/<dxfs count="\d+"\s*\/>/.test(styles)) return styles.replace(/<dxfs count="\d+"\s*\/>/, dxf)
  if (/<dxfs count="\d+">[\s\S]*?<\/dxfs>/.test(styles)) return styles.replace(/<dxfs count="\d+">[\s\S]*?<\/dxfs>/, dxf)
  return styles.replace(/<\/styleSheet>/, `${dxf}</styleSheet>`)
}
function hardenTemplateSheet(sheetXml: string, schema: ModuleSchema, unlockedStyleIndex: number): string {
  const lastColumn = XLSX.utils.encode_col(schema.fields.length - 1)
  const ref = `A1:${lastColumn}${DATA_ROWS + 1}`
  if (!sheetXml.includes('xmlns:r=')) {
    sheetXml = sheetXml.replace(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    )
  }
  sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${ref}"/>`)
  sheetXml = sheetXml.replace(
    /<sheetView([^>]*)\/>/,
    '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>',
  )
  const headerRow = sheetXml.match(/<row\b[^>]*\br="1"[^>]*>[\s\S]*?<\/row>/)?.[0]
  if (!headerRow) throw new Error('Unable to locate the template header row.')
  const dataRows = Array.from({ length: DATA_ROWS }, (_, rowIndex) => {
    const row = rowIndex + 2
    const cells = schema.fields
      .map((_field, columnIndex) => `<c r="${XLSX.utils.encode_col(columnIndex)}${row}" s="${unlockedStyleIndex}"/>`)
      .join('')
    return `<row r="${row}">${cells}</row>`
  }).join('')
  sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRow}${dataRows}</sheetData>`)
  const validations = schema.fields
    .map((field, index) => validation(field, XLSX.utils.encode_col(index)))
    .filter((item): item is string => Boolean(item))
  const requiredRules = schema.fields.map((field, index) => {
    if (!field.required) return ''
    const column = XLSX.utils.encode_col(index)
    return `<conditionalFormatting sqref="${column}2:${column}${DATA_ROWS + 1}"><cfRule type="expression" dxfId="0" priority="${index + 1}"><formula>AND(COUNTA($A2:$${lastColumn}2)&gt;0,LEN(TRIM(${column}2))=0)</formula></cfRule></conditionalFormatting>`
  }).join('')
  const guestIdentityRule = schema.key === 'guests'
    ? `<conditionalFormatting sqref="A2:${lastColumn}${DATA_ROWS + 1}"><cfRule type="expression" dxfId="0" priority="${schema.fields.length + 1}"><formula>AND(COUNTA($A2:$${lastColumn}2)&gt;0,COUNTA($A2,$B2,$D2,$E2)=0)</formula></cfRule></conditionalFormatting>`
    : ''
  const duplicateIdentityRules = ['guestId', 'email'].map((key, ruleIndex) => {
    const index = schema.fields.findIndex((field) => field.key === key)
    if (index < 0) return ''
    const column = XLSX.utils.encode_col(index)
    return `<conditionalFormatting sqref="${column}2:${column}${DATA_ROWS + 1}"><cfRule type="expression" dxfId="0" priority="${schema.fields.length + ruleIndex + 2}"><formula>AND(LEN(TRIM(${column}2))&gt;0,COUNTIF($${column}$2:$${column}$${DATA_ROWS + 1},${column}2)&gt;1)</formula></cfRule></conditionalFormatting>`
  }).join('')
  const conditionalRules = `${requiredRules}${guestIdentityRule}${duplicateIdentityRules}`
  const protection = '<sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="1" selectUnlockedCells="0" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" sort="0" autoFilter="0" pivotTables="1"/>'
  const filter = `<autoFilter ref="${ref}"/>`
  const validationXml = validations.length ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>` : ''
  const tableParts = '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>'
  sheetXml = sheetXml.replace('</sheetData>', `</sheetData>${protection}${filter}${conditionalRules}${validationXml}`)
  return sheetXml.replace(/<\/worksheet>/, `${tableParts}</worksheet>`)
}
function tableXml(schema: ModuleSchema): string {
  const lastColumn = XLSX.utils.encode_col(schema.fields.length - 1)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Wewed${schema.key.replace(/[^A-Za-z0-9]/g, '')}Data" displayName="Wewed${schema.key.replace(/[^A-Za-z0-9]/g, '')}Data" ref="A1:${lastColumn}${DATA_ROWS + 1}" totalsRowShown="0"><autoFilter ref="A1:${lastColumn}${DATA_ROWS + 1}"/><tableColumns count="${schema.fields.length}">${schema.fields.map((field, index) => `<tableColumn id="${index + 1}" name="${xml(field.label)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`
}

export function generateTemplate(schema: ModuleSchema): Buffer {
  const workbook = XLSX.utils.book_new()
  const header = schema.fields.map((field) => field.label)
  const blankRows = Array.from({ length: DATA_ROWS }, () => schema.fields.map(() => ''))
  const template = XLSX.utils.aoa_to_sheet([header, ...blankRows])
  template['!cols'] = schema.fields.map((field) => ({ wch: Math.max(14, Math.min(40, Math.max(field.label.length, field.example?.length ?? 0) + 4)) }))
  XLSX.utils.book_append_sheet(workbook, template, 'Template')

  const instructionRows = instructions(schema)
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows)
  instructionSheet['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 32 }, { wch: 10 }, { wch: 48 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions')

  const about = XLSX.utils.aoa_to_sheet([
    ['wewed — Import Template'], [''], ['Module', schema.name], ['Module Key', schema.key], ['Template Version', schema.version], ['Workbook Contract', '2.0'], ['Compatible Import Engine', 'wewed planner 2.x'], ['Description', schema.description], ['Generated At', new Date().toISOString()], [''],
    ['SECURITY AND COMPATIBILITY'], ['• Only the first worksheet is imported. Keep “Template” first.'], ['• Formula cells are rejected during preview with their row and column. Paste plain values only.'], ['• Sensitive fields contain personal information. Restrict sharing in Excel and Google Drive.'], ['• Empty rows are skipped. Do not rename or remove the header row.'], [''],
    ['EXCEL WORKFLOW'], [`1. Enter ${schema.name.toLowerCase()} records in the blank rows of the Template table.`], ['2. Use the provided dropdowns and numeric validation.'], ['3. Save as .xlsx. Upload, review every preview action, then execute.'], [''],
    ['GOOGLE SHEETS WORKFLOW'], ['1. Upload this .xlsx to Google Drive and open it with Google Sheets.'], ['2. Keep the Template sheet first and preserve the exact headers.'], ['3. Download as Microsoft Excel (.xlsx) before importing back into wewed.'], ['4. Review the preview because Google Sheets may adjust workbook validation or formatting.'], [''],
    ['EXAMPLES'], ['Examples are shown only in the Instructions sheet. They are not importable data.'], ['Reimporting an unchanged export should produce only skipped rows.'],
  ])
  about['!cols'] = [{ wch: 24 }, { wch: 82 }]
  XLSX.utils.book_append_sheet(workbook, about, 'About')

  const raw = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }))
  const entries = readZipEntries(raw)
  const contentTypes = entries.get('[Content_Types].xml')?.toString('utf8') ?? ''
  const styles = entries.get('xl/styles.xml')?.toString('utf8') ?? ''
  const unlockedStyleIndex = Number(styles.match(/<cellXfs count="(\d+)">/)?.[1] ?? 0)
  if (!Number.isInteger(unlockedStyleIndex) || unlockedStyleIndex < 1) {
    throw new Error('Unable to determine the template data-entry style.')
  }
  const sheet = entries.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? ''
  const patchedTypes = contentTypes.replace('</Types>', '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>')
  const relationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>'
  return patchXlsx(raw, {
    '[Content_Types].xml': patchedTypes,
    'xl/styles.xml': addUnlockedStyle(styles),
    'xl/worksheets/sheet1.xml': hardenTemplateSheet(sheet, schema, unlockedStyleIndex),
    'xl/worksheets/_rels/sheet1.xml.rels': relationships,
    'xl/tables/table1.xml': tableXml(schema),
  })
}
