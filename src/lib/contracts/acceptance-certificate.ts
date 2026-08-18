import 'server-only'

type AcceptanceCertificateModel = {
  contractNumber: string
  title: string
  versionNumber: number
  effectiveAt: string
  contentSha256: string
  artifactSha256: string
  declarationVersion: string
  acceptances: Array<{
    role: string
    partyName: string
    decisionAt: string
    identityKind: string
    receiptId: string
  }>
}

function printable(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdf(value: string): string {
  return printable(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrap(value: string, width = 86): string[] {
  const words = printable(value).split(' ').filter(Boolean)
  const result: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) line = word
    else if (`${line} ${word}`.length <= width) line += ` ${word}`
    else {
      result.push(line)
      line = word
    }
  }
  if (line) result.push(line)
  return result.length ? result : ['']
}

function pdfFromLines(lines: Array<{ text: string; bold?: boolean; size?: number }>): Uint8Array {
  const operations = ['BT', '48 792 Td']
  for (const row of lines) {
    const font = row.bold ? 'F2' : 'F1'
    const size = row.size ?? 10
    operations.push(`/${font} ${size} Tf (${escapePdf(row.text)}) Tj 0 -15 Td`)
  }
  operations.push('ET')
  const stream = operations.join('\n')
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [5 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ]
  let output = '%PDF-1.4\n%WewedAcceptance\n'
  const offsets = [0]
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(output, 'latin1')
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(output, 'latin1')
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i += 1) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(output, 'latin1'))
}

export function renderAcceptanceCertificatePdf(model: AcceptanceCertificateModel): Uint8Array {
  const lines: Array<{ text: string; bold?: boolean; size?: number }> = [
    { text: 'WEWED', bold: true, size: 18 },
    { text: 'wewed.pro | Acceptance Certificate', bold: true, size: 13 },
    { text: '' },
    { text: model.title, bold: true, size: 14 },
    { text: `${model.contractNumber} | Version ${model.versionNumber}` },
    { text: `Effective at (server time): ${model.effectiveAt}` },
    { text: `Declaration version: ${model.declarationVersion}` },
    { text: '' },
    { text: 'EXACT VERSION FINGERPRINTS', bold: true, size: 11 },
    { text: `Canonical SHA-256: ${model.contentSha256}` },
    { text: `Issued artifact SHA-256: ${model.artifactSha256}` },
    { text: '' },
    { text: 'PARTY ACCEPTANCE RECEIPTS', bold: true, size: 11 },
  ]
  for (const acceptance of model.acceptances) {
    for (const text of wrap(`${acceptance.role}: ${acceptance.partyName} | ${acceptance.decisionAt} | ${acceptance.identityKind} | receipt ${acceptance.receiptId}`)) {
      lines.push({ text })
    }
  }
  lines.push(
    { text: '' },
    { text: 'This certificate records governed Wewed acceptance evidence for the exact version above.', size: 9 },
    { text: 'It does not make Wewed the merchant, service provider, guarantor, or adjudicator.', size: 9 },
    { text: 'Acceptance was explicit; viewing, payment, or message delivery was not treated as acceptance.', size: 9 },
  )
  return pdfFromLines(lines)
}
