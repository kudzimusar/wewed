import 'server-only'

import QRCode from 'qrcode'

export interface ContractPdfModel {
  contractNumber: string
  title: string
  versionNumber: number
  templateVersion: string
  reviewStatus: string
  weddingTitle: string
  weddingDate: string
  serviceCategory: string
  serviceDescription: string
  serviceLocation: string
  agreedAmount: string
  currency: string
  parties: Array<{ role: string; displayName: string; authorityBasis?: string | null }>
  clauses: Array<{ title: string; body: string }>
  contentSha256: string
  verificationUrl: string
}

function printable(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
}

function wrap(value: string, width = 88): string[] {
  const words = printable(value).split(' ').filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
      continue
    }
    if (`${current} ${word}`.length <= width) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function escapePdfText(value: string): string {
  return printable(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function line(text: string, size = 10): string {
  return `/${size >= 14 ? 'F2' : 'F1'} ${size} Tf (${escapePdfText(text)}) Tj 0 -14 Td`
}

function qrOperations(value: string): string[] {
  const code = QRCode.create(value, { errorCorrectionLevel: 'M' })
  const modules = code.modules
  const quietZone = 2
  const side = 104
  const moduleSize = side / (modules.size + quietZone * 2)
  const originX = 612 - 50 - side
  const originY = 42
  const operations = ['q', '0 0 0 rg']

  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (!modules.get(row, column)) continue
      const x = originX + (column + quietZone) * moduleSize
      const y = originY + (modules.size - row - 1 + quietZone) * moduleSize
      operations.push(`${x.toFixed(3)} ${y.toFixed(3)} ${moduleSize.toFixed(3)} ${moduleSize.toFixed(3)} re f`)
    }
  }
  operations.push('Q')
  return operations
}

function buildPageContent(
  lines: Array<{ text: string; size?: number }>,
  verificationUrl?: string,
): string {
  const operations = ['BT', '50 792 Td']
  for (const item of lines) operations.push(line(item.text, item.size ?? 10))
  operations.push('ET')
  if (verificationUrl) operations.push(...qrOperations(verificationUrl))
  return operations.join('\n')
}

function pageLines(model: ContractPdfModel): Array<{ text: string; size?: number }> {
  const lines: Array<{ text: string; size?: number }> = [
    { text: 'WEWED', size: 18 },
    { text: 'wewed.pro', size: 10 },
    { text: model.title, size: 16 },
    { text: `${model.contractNumber} | Version ${model.versionNumber} | Template ${model.templateVersion}`, size: 10 },
    { text: `Template review status: ${model.reviewStatus}. No jurisdiction-specific enforceability claim is made by this label.`, size: 9 },
    { text: '' },
    { text: `Wedding: ${model.weddingTitle}` },
    { text: `Wedding date: ${model.weddingDate}` },
    { text: `Service: ${model.serviceCategory}` },
    { text: `Service location: ${model.serviceLocation || 'Not specified'}` },
    { text: `Agreed amount: ${model.agreedAmount || 'Not specified'} ${model.currency}` },
    { text: '' },
    { text: 'SERVICE SCOPE', size: 12 },
  ]
  for (const wrapped of wrap(model.serviceDescription || 'No additional service description was recorded.')) {
    lines.push({ text: wrapped })
  }

  lines.push({ text: '' }, { text: 'PARTIES AND RECORDED AUTHORITY', size: 12 })
  for (const party of model.parties) {
    for (const wrapped of wrap(`${party.role}: ${party.displayName}${party.authorityBasis ? ` — ${party.authorityBasis}` : ''}`)) {
      lines.push({ text: wrapped })
    }
  }

  for (const clause of model.clauses) {
    lines.push({ text: '' }, { text: clause.title.toUpperCase(), size: 12 })
    for (const wrapped of wrap(clause.body)) lines.push({ text: wrapped })
  }

  lines.push(
    { text: '' },
    { text: 'VERSION VERIFICATION', size: 12 },
    { text: `Canonical SHA-256: ${model.contentSha256}` },
  )
  for (const wrapped of wrap(`Verification: ${model.verificationUrl}`)) lines.push({ text: wrapped })
  lines.push(
    { text: '' },
    { text: 'Scan the verification QR printed at the foot of this final page.', size: 9 },
    { text: 'Created and governed through Wewed | wewed.pro', size: 9 },
    { text: 'Viewing this document does not constitute acceptance. Acceptance is a separate governed action.', size: 9 },
  )
  return lines
}

export function renderContractPdf(model: ContractPdfModel): Uint8Array {
  const allLines = pageLines(model)
  // Reserve the lower part of the page so the verification QR never overlaps contract text.
  const maxLinesPerPage = 42
  const chunks: Array<Array<{ text: string; size?: number }>> = []
  for (let index = 0; index < allLines.length; index += maxLinesPerPage) {
    chunks.push(allLines.slice(index, index + maxLinesPerPage))
  }

  const objects: string[] = []
  const pageObjectIds: number[] = []

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'

  let nextId = 5
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    const pageId = nextId++
    const contentId = nextId++
    pageObjectIds.push(pageId)
    const stream = buildPageContent(
      chunk,
      index === chunks.length - 1 ? model.verificationUrl : undefined,
    )
    const streamLength = Buffer.byteLength(stream, 'latin1')
    objects[contentId] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`

  let output = '%PDF-1.4\n%Wewed\n'
  const offsets: number[] = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(output, 'latin1')
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(output, 'latin1')
  output += `xref\n0 ${objects.length}\n`
  output += '0000000000 65535 f \n'
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new Uint8Array(Buffer.from(output, 'latin1'))
}
