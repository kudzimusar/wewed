export type PlannerDocumentOrientation = 'portrait' | 'landscape'

export interface PlannerDocumentColumn {
  key: string
  label: string
  width?: string
}

export interface PlannerDocumentRow {
  id: string
  cells: Record<string, string | number | null | undefined>
}

export interface PlannerDocumentSummaryItem {
  label: string
  value: string | number
}

export interface PlannerDocumentInput {
  weddingTitle: string
  weddingDate?: string | null
  location?: string | null
  worksheetName: string
  scopeLabel: string
  orientation?: PlannerDocumentOrientation
  columns: PlannerDocumentColumn[]
  rows: PlannerDocumentRow[]
  summary?: PlannerDocumentSummaryItem[]
  note?: string | null
}

export function escapePlannerDocumentHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function dateLabel(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function generatedLabel(): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

export function buildPlannerDocumentHtml(input: PlannerDocumentInput): string {
  const orientation = input.orientation ?? 'portrait'
  const weddingTitle = escapePlannerDocumentHtml(input.weddingTitle || 'Wedding')
  const worksheet = escapePlannerDocumentHtml(input.worksheetName)
  const scope = escapePlannerDocumentHtml(input.scopeLabel)
  const weddingDate = escapePlannerDocumentHtml(dateLabel(input.weddingDate))
  const location = escapePlannerDocumentHtml(input.location || '')
  const summary = (input.summary ?? [])
    .map(
      (item) =>
        `<div class="summary-item"><span>${escapePlannerDocumentHtml(item.label)}</span><strong>${escapePlannerDocumentHtml(item.value)}</strong></div>`,
    )
    .join('')

  const colgroup = input.columns
    .map((column) => `<col${column.width ? ` style="width:${escapePlannerDocumentHtml(column.width)}"` : ''}>`)
    .join('')
  const headers = input.columns
    .map((column) => `<th scope="col">${escapePlannerDocumentHtml(column.label)}</th>`)
    .join('')
  const rows = input.rows.length
    ? input.rows
        .map(
          (row) =>
            `<tr data-record-id="${escapePlannerDocumentHtml(row.id)}">${input.columns
              .map((column) => `<td>${escapePlannerDocumentHtml(row.cells[column.key])}</td>`)
              .join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${Math.max(1, input.columns.length)}" class="empty">No records in this document scope.</td></tr>`

  const metadata = [weddingDate, location].filter(Boolean).join(' · ')
  const note = input.note
    ? `<p class="document-note">${escapePlannerDocumentHtml(input.note)}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${weddingTitle} — ${worksheet}</title>
<style>
  @page { size: A4 ${orientation}; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #211711; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.38; }
  header { border-bottom: 1.5pt solid #9b7b42; padding-bottom: 7mm; margin-bottom: 6mm; }
  .brand { margin: 0 0 2mm; font-size: 8pt; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #6e572f; }
  h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20pt; font-weight: 500; }
  .worksheet { margin: 1mm 0 0; font-size: 11pt; font-weight: 700; }
  .meta { margin: 1.5mm 0 0; color: #62584f; }
  .scope { margin-top: 2mm; font-size: 8.5pt; color: #62584f; }
  .summary { display: flex; flex-wrap: wrap; gap: 3mm; margin: 0 0 5mm; }
  .summary-item { min-width: 31mm; border: 1px solid #d8cec0; padding: 2.5mm 3mm; break-inside: avoid; }
  .summary-item span { display: block; color: #6c6259; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em; }
  .summary-item strong { display: block; margin-top: 1mm; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #f1ece4; color: #211711; border: 1px solid #cfc4b5; padding: 2.2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; text-align: left; vertical-align: top; }
  td { border: 1px solid #ddd4c8; padding: 2.2mm; vertical-align: top; overflow-wrap: anywhere; word-break: normal; white-space: pre-wrap; }
  tbody tr:nth-child(even) td { background: #faf8f5; }
  .empty { padding: 12mm; text-align: center; color: #74695f; }
  .document-note { margin: 4mm 0 0; color: #62584f; font-size: 8pt; }
  footer { margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #ddd4c8; color: #756960; font-size: 7.5pt; display: flex; justify-content: space-between; gap: 5mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<header>
  <p class="brand">Wewed Planner Workspace</p>
  <h1>${weddingTitle}</h1>
  <p class="worksheet">${worksheet}</p>
  ${metadata ? `<p class="meta">${metadata}</p>` : ''}
  <p class="scope">Document scope: ${scope}</p>
</header>
${summary ? `<section class="summary" aria-label="Worksheet summary">${summary}</section>` : ''}
<table>
  <colgroup>${colgroup}</colgroup>
  <thead><tr>${headers}</tr></thead>
  <tbody>${rows}</tbody>
</table>
${note}
<footer><span>Generated ${escapePlannerDocumentHtml(generatedLabel())}</span><span>Wewed · ${worksheet}</span></footer>
</body>
</html>`
}

export function openPlannerPrintDocument(input: PlannerDocumentInput): boolean {
  if (typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=1200,height=900')
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(buildPlannerDocumentHtml(input))
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 150)
  return true
}
