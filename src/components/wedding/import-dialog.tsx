'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface ImportDialogProps {
  moduleKey: string
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

type Step = 'upload' | 'preview' | 'confirm' | 'result'

interface RowAction {
  action: 'create' | 'update' | 'skip' | 'invalid'
  rowIndex: number
  raw: Record<string, string>
  mapped: Record<string, string>
  errors: string[]
  warnings: string[]
}

interface ImportPreview {
  fileName: string
  moduleKey: string
  templateVersion: string
  totalRows: number
  validRows: number
  invalidRows: number
  newRecords: number
  updateRecords: number
  duplicateRecords: number
  conflictingRecords: number
  skippedRecords: number
  rows: RowAction[]
  fieldMapping: Record<string, string>
  unmappedColumns: string[]
  missingRequired: string[]
}

interface ImportResult {
  jobId: string
  created: number
  updated: number
  skipped: number
  errors: number
  errorReport: Array<{ row: number; errors: string[] }>
  rollbackToken: string
}

const MODULE_LABELS: Record<string, string> = {
  guests: 'Guest List',
  budget: 'Budget',
  checklist: 'Checklist',
  seating: 'Seating Chart',
  vendors: 'Vendors',
  timeline: 'Timeline',
  songs: 'Songs',
  'wedding-party': 'Wedding Party',
  travel: 'Travel',
  media: 'Media',
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

export function ImportDialog({ moduleKey, isOpen, onClose, onComplete }: ImportDialogProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const reviewTableScrollRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rolledBack, setRolledBack] = useState(false)

  const moduleLabel = MODULE_LABELS[moduleKey] ?? moduleKey

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setJobId(null)
    setPreview(null)
    setResult(null)
    setMappingOverrides({})
    setBusy(false)
    setProgress(0)
    setError(null)
    setRolledBack(false)
  }, [])

  useEffect(() => {
    if (isOpen) reset()
  }, [isOpen, reset])

  async function upload(selected: File) {
    setError(null)
    if (!/\.(xlsx|csv)$/i.test(selected.name)) {
      setError('Choose a .xlsx or .csv file.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('The file is larger than 10 MB.')
      return
    }

    setFile(selected)
    setBusy(true)
    setProgress(25)
    try {
      const form = new FormData()
      form.append('file', selected)
      form.append('moduleKey', moduleKey)
      setProgress(55)
      const response = await fetch('/api/imports', { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok || !payload.success || !payload.preview || !payload.jobId) {
        throw new Error(payload.error || 'Unable to preview spreadsheet.')
      }
      setProgress(100)
      setJobId(payload.jobId)
      setPreview(payload.preview)
      setMappingOverrides({})
      setStep('preview')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to preview spreadsheet.')
      setFile(null)
    } finally {
      setBusy(false)
      window.setTimeout(() => setProgress(0), 300)
    }
  }

  async function execute() {
    if (!jobId || !preview) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/imports/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingOverrides }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(payload.error || 'Unable to execute import.')
      }
      setResult(payload.result)
      setStep('result')
      toast({
        title: 'Import complete',
        description: `${payload.result.created} created · ${payload.result.updated} updated`,
      })
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : 'Unable to execute import.')
    } finally {
      setBusy(false)
    }
  }

  async function rollback() {
    if (!jobId || !result?.rollbackToken || rolledBack) return
    if (!window.confirm('Reverse this import and restore updated records?')) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/imports/${encodeURIComponent(jobId)}?rollbackToken=${encodeURIComponent(result.rollbackToken)}`,
        { method: 'DELETE' },
      )
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to roll back import.')
      setRolledBack(true)
      toast({
        title: 'Import rolled back',
        description: `${payload.rollback.deleted} deleted · ${payload.rollback.restored} restored`,
      })
      onComplete?.()
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Unable to roll back import.')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (step === 'result') onComplete?.()
    onClose()
  }

  function chooseAnotherFile() {
    setError(null)
    setStep('upload')
    setPreview(null)
    setJobId(null)
    setMappingOverrides({})
    window.setTimeout(() => inputRef.current?.click(), 0)
  }

  const sourceColumns = useMemo(() => Object.keys(preview?.fieldMapping ?? {}), [preview])
  const targetFields = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.values(preview?.fieldMapping ?? {}),
          ...(preview?.missingRequired ?? []),
        ]),
      ).filter(Boolean),
    [preview],
  )
  const hasRows = Boolean(preview && preview.totalRows > 0)

  useEffect(() => {
    if (step !== 'preview' || !preview) return
    const frame = window.requestAnimationFrame(() => {
      const container = reviewTableScrollRef.current
      if (!container) return
      container.scrollTop = 0
      container.scrollLeft = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [step, preview?.fileName])

  const blocking = Boolean(preview && (preview.missingRequired.length || preview.validRows === 0))
  const blockingMessage = preview?.missingRequired.length
    ? `Map the required fields: ${preview.missingRequired.join(', ')}.`
    : preview && preview.totalRows > 0 && preview.validRows === 0
      ? 'No valid rows are available to review. Correct the spreadsheet and upload it again.'
      : null

  function downloadErrors() {
    if (!preview) return
    const rows = preview.rows.filter((row) => row.errors.length)
    const csv = ['Row,Errors', ...rows.map((row) => `${row.rowIndex},"${row.errors.join('; ').replaceAll('"', '""')}"`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `wewed-${moduleKey}-import-errors.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(value) => !value && close()}>
      <DialogContent
        data-testid="import-dialog"
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-gold/30 bg-espresso p-0 text-champagne sm:h-[min(94dvh,58rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:rounded-xl"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (selected) void upload(selected)
            event.target.value = ''
          }}
        />

        <div className="shrink-0 border-b border-gold/15 px-4 py-4 pr-14 sm:px-6 sm:py-4 sm:pr-16">
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <FileSpreadsheet className="size-5 shrink-0 text-gold" />
            Import {moduleLabel}
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-3xl text-sm leading-5 text-champagne/50">
            Preview, correct field mapping, confirm and retain a persistent rollback.
          </DialogDescription>
          <StepBar step={step} />
        </div>

        {progress > 0 && <Progress value={progress} className="shrink-0 rounded-none" />}
        {error && (
          <div role="alert" className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay-light sm:mx-6">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div
          data-testid="import-dialog-scroll"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 touch-pan-y [scrollbar-gutter:stable] sm:px-6 sm:py-6"
        >
          {step === 'upload' && (
            <div className="mx-auto max-w-xl rounded-xl border border-dashed border-gold/35 bg-gold/5 p-6 text-center sm:p-10">
              <Upload className="mx-auto size-10 text-gold" />
              <h3 className="mt-4 text-lg">Upload {moduleLabel} spreadsheet</h3>
              <p className="mt-2 text-sm leading-5 text-champagne/50">
                Accepted formats: .xlsx and .csv, up to 10 MB. The file is previewed before any data is written.
              </p>
              <Button
                type="button"
                className="mt-5 min-h-11 w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Choose file
              </Button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Rows" value={preview.totalRows} />
                <Stat label="Create" value={preview.newRecords} />
                <Stat label="Update" value={preview.updateRecords} />
                <Stat label="Skip" value={preview.skippedRecords} />
                <Stat label="Invalid" value={preview.invalidRows} warning={preview.invalidRows > 0} />
                <Stat label="Duplicates" value={preview.duplicateRecords} />
              </div>

              {!hasRows ? (
                <div data-testid="import-empty-preview" className="mx-auto max-w-2xl rounded-xl border border-gold/25 bg-gold/[0.06] p-6 text-center sm:p-8">
                  <CheckCircle2 className="mx-auto size-11 text-gold" />
                  <h3 className="mt-4 font-serif text-xl text-champagne">Blank template confirmed</h3>
                  <p className="mt-2 text-sm leading-6 text-champagne/55">
                    No data rows were found. This untouched template is safe and cannot create or update planner records. Add your guest data to the Template sheet, save the file, and upload it again.
                  </p>
                  <p className="mt-3 text-xs text-champagne/40">File: {preview.fileName}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-gold/15 bg-espresso/45 p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-medium">Field mapping</h3>
                      <span className="text-[10px] text-champagne/45">Changes are revalidated before execution</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {sourceColumns.map((source) => {
                        const value = mappingOverrides[source] ?? preview.fieldMapping[source] ?? ''
                        return (
                          <div key={source} className="grid min-w-0 gap-2 rounded-md border border-gold/10 p-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(9rem,12rem)] sm:items-center">
                            <span className="min-w-0 truncate text-xs" title={source}>{source}</span>
                            <ArrowRight className="hidden size-3 text-gold/50 sm:block" />
                            <Select
                              value={value || '__ignore__'}
                              onValueChange={(target) => setMappingOverrides((current) => ({
                                ...current,
                                [source]: target === '__ignore__' ? '' : target,
                              }))}
                            >
                              <SelectTrigger className="h-10 w-full min-w-0 border-gold/25 bg-espresso/60 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">Ignore</SelectItem>
                                {targetFields.map((target) => <SelectItem key={target} value={target}>{target}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })}
                    </div>
                    {preview.missingRequired.length > 0 && (
                      <p role="alert" className="mt-3 text-xs text-clay-light">
                        Missing required mapping: {preview.missingRequired.join(', ')}
                      </p>
                    )}
                  </div>

                  <ImportReviewRows
                    rows={preview.rows}
                    sourceColumns={sourceColumns}
                    scrollRef={reviewTableScrollRef}
                  />

                  {blockingMessage && (
                    <div role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay-light">
                      {blockingMessage}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'confirm' && preview && (
            <div className="space-y-5">
              <div className="mx-auto max-w-xl rounded-xl border border-gold/25 bg-gold/5 p-6 text-center sm:p-8">
                <CheckCircle2 className="mx-auto size-12 text-gold" />
                <h3 className="mt-4 text-xl">Import {preview.newRecords + preview.updateRecords} records?</h3>
                <p className="mt-2 text-sm text-champagne/55">
                  {preview.newRecords} new · {preview.updateRecords} updates · {preview.skippedRecords} skipped · {preview.invalidRows} invalid
                </p>
                <p className="mt-4 text-xs leading-5 text-champagne/45">
                  The preview and rollback snapshot are stored against the active wedding and survive a server restart.
                </p>
              </div>
              <ImportConfirmationRows
                rows={preview.rows.filter((row) => row.action === 'create' || row.action === 'update')}
                sourceColumns={sourceColumns}
              />
            </div>
          )}

          {step === 'result' && result && (
            <div className="mx-auto max-w-xl space-y-5">
              <div className={`rounded-xl border p-6 text-center sm:p-8 ${rolledBack ? 'border-gold/30 bg-gold/5' : 'border-sage/30 bg-sage/5'}`}>
                {rolledBack ? <RotateCcw className="mx-auto size-12 text-gold" /> : <CheckCircle2 className="mx-auto size-12 text-sage-light" />}
                <h3 className="mt-4 text-xl">{rolledBack ? 'Import rolled back' : 'Import completed'}</h3>
                <p className="mt-2 text-sm text-champagne/55">
                  {result.created} created · {result.updated} updated · {result.skipped} skipped · {result.errors} errors
                </p>
              </div>
              {!rolledBack && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full border-clay/30 bg-transparent text-clay-light"
                  disabled={busy}
                  onClick={() => void rollback()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Roll back this import
                </Button>
              )}
            </div>
          )}
        </div>

        <div
          data-testid="import-dialog-footer"
          className="shrink-0 border-t border-gold/15 bg-espresso/98 px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] pr-20 backdrop-blur-md sm:px-6 sm:py-4 sm:pr-20 lg:pr-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step === 'preview' && preview.invalidRows > 0 && hasRows && (
                <Button type="button" variant="ghost" size="sm" onClick={downloadErrors} className="w-full sm:w-auto">
                  <Download className="size-4" />
                  Error CSV
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {step !== 'upload' && step !== 'result' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep(step === 'confirm' ? 'preview' : 'upload')}
                  className="min-h-11 w-full border-gold/25 bg-transparent sm:w-auto"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              )}
              {step === 'preview' && !hasRows && (
                <>
                  <Button type="button" variant="outline" onClick={close} className="min-h-11 w-full border-gold/25 bg-transparent sm:w-auto">
                    Close preview
                  </Button>
                  <Button type="button" onClick={chooseAnotherFile} className="min-h-11 w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto">
                    <Upload className="size-4" />
                    Choose another file
                  </Button>
                </>
              )}
              {step === 'preview' && hasRows && (
                <Button
                  type="button"
                  disabled={busy || blocking}
                  aria-describedby={blockingMessage ? 'import-review-blocked-reason' : undefined}
                  onClick={() => setStep('confirm')}
                  className="min-h-11 w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto"
                >
                  Review import
                  <ArrowRight className="size-4" />
                </Button>
              )}
              {step === 'confirm' && (
                <Button type="button" disabled={busy} onClick={() => void execute()} className="min-h-11 w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Import now
                </Button>
              )}
              {step === 'result' && (
                <Button type="button" onClick={close} className="min-h-11 w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto">
                  View in planner
                </Button>
              )}
            </div>
          </div>
          {blockingMessage && step === 'preview' && hasRows && (
            <p id="import-review-blocked-reason" className="mt-2 text-right text-xs text-clay-light">
              {blockingMessage}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


const REVIEW_COLUMN_PRIORITY = [
  'Guest ID',
  'First Name',
  'Last Name',
  'Display Name',
  'Task',
  'Task Title',
  'Title',
  'Vendor Name',
  'Email',
  'Phone',
]

function reviewColumns(sourceColumns: string[]) {
  const selected: string[] = []
  for (const column of REVIEW_COLUMN_PRIORITY) {
    if (sourceColumns.includes(column) && !selected.includes(column)) selected.push(column)
  }
  for (const column of sourceColumns) {
    if (!selected.includes(column)) selected.push(column)
    if (selected.length >= 6) break
  }
  return selected.slice(0, 6)
}

function rowIssues(row: RowAction) {
  return row.errors.length ? row.errors.join('; ') : row.warnings.join('; ') || 'Ready'
}

function ImportReviewRows({
  rows,
  sourceColumns,
  scrollRef,
}: {
  rows: RowAction[]
  sourceColumns: string[]
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const columns = reviewColumns(sourceColumns)
  const visibleRows = rows.slice(0, 100)

  return (
    <section aria-labelledby="import-review-records-heading" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="import-review-records-heading" className="text-sm font-medium text-champagne">Records found</h3>
          <p className="text-xs leading-5 text-champagne/45">Review the action and identity fields before continuing.</p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-champagne/35">{visibleRows.length} shown</p>
      </div>

      <div data-testid="import-review-cards" className="grid gap-3 md:hidden">
        {visibleRows.map((row) => (
          <article key={row.rowIndex} className="rounded-xl border border-gold/15 bg-espresso/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-champagne">Row {row.rowIndex}</span>
              <Action action={row.action} />
            </div>
            <dl className="mt-3 grid gap-2">
              {columns.map((column) => (
                <div key={column} className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                  <dt className="text-xs text-champagne/45">{column}</dt>
                  <dd className="break-words text-right text-xs text-champagne">{row.raw[column] || '—'}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                <dt className="text-xs text-champagne/45">Issues</dt>
                <dd className={`break-words text-right text-xs ${row.errors.length ? 'text-clay-light' : 'text-champagne/55'}`}>
                  {rowIssues(row)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gold/15 md:block">
        <div
          ref={scrollRef}
          data-testid="import-review-table-scroll"
          className="max-h-[min(24rem,45dvh)] overflow-auto overscroll-contain touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
        >
          <Table className="min-w-[56rem]" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-20 bg-espresso shadow-[0_1px_0_rgba(191,155,95,0.25)]">
              <TableRow className="bg-espresso hover:bg-espresso">
                <TableHead data-testid="import-review-row-header" className="sticky left-0 z-30 w-16 bg-espresso">Row</TableHead>
                <TableHead>Action</TableHead>
                {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.rowIndex}>
                  <TableCell className="sticky left-0 z-10 bg-espresso font-medium">{row.rowIndex}</TableCell>
                  <TableCell><Action action={row.action} /></TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className="max-w-52 truncate" title={row.raw[column] || '—'}>{row.raw[column] || '—'}</TableCell>
                  ))}
                  <TableCell className={row.errors.length ? 'max-w-80 whitespace-normal text-clay-light' : 'max-w-80 whitespace-normal text-champagne/45'}>
                    {rowIssues(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

function ImportConfirmationRows({ rows, sourceColumns }: { rows: RowAction[]; sourceColumns: string[] }) {
  const columns = reviewColumns(sourceColumns)
  const visibleRows = rows.slice(0, 10)

  return (
    <section data-testid="import-confirmation-records" aria-labelledby="import-confirmation-records-heading" className="rounded-xl border border-gold/15 bg-espresso/45 p-4 sm:p-5">
      <h3 id="import-confirmation-records-heading" className="text-sm font-medium text-champagne">Records ready to import</h3>
      <p className="mt-1 text-xs leading-5 text-champagne/45">Confirm the action and identity details before writing to the active wedding.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visibleRows.map((row) => (
          <article key={row.rowIndex} className="rounded-lg border border-gold/15 bg-espresso/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-champagne">Row {row.rowIndex}</span>
              <Action action={row.action} />
            </div>
            <dl className="mt-3 grid gap-2">
              {columns.map((column) => (
                <div key={column} className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                  <dt className="text-xs text-champagne/45">{column}</dt>
                  <dd className="break-words text-right text-xs text-champagne">{row.raw[column] || '—'}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {rows.length > visibleRows.length && (
        <p className="mt-3 text-xs text-champagne/45">Plus {rows.length - visibleRows.length} additional record{rows.length - visibleRows.length === 1 ? '' : 's'}.</p>
      )}
    </section>
  )
}

function Stat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div
      data-testid={`import-stat-${label.toLowerCase().replaceAll(' ', '-')}`}
      className="rounded-md border border-gold/15 bg-espresso/45 p-3 text-center"
    >
      <p className={`text-xl ${warning ? 'text-clay-light' : 'text-gold'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-champagne/45">{label}</p>
    </div>
  )
}

function Action({ action }: { action: RowAction['action'] }) {
  return (
    <Badge
      variant="outline"
      className={
        action === 'invalid'
          ? 'border-clay/30 text-clay-light'
          : action === 'create'
            ? 'border-sage/30 text-sage-light'
            : 'border-gold/25 text-gold'
      }
    >
      {action}
    </Badge>
  )
}

function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ['upload', 'preview', 'confirm', 'result']
  const index = steps.indexOf(step)
  return (
    <div className="mt-3 flex gap-1" aria-label={`Import step ${index + 1} of ${steps.length}`}>
      {steps.map((item, itemIndex) => (
        <div key={item} className={`h-1 flex-1 rounded ${itemIndex <= index ? 'bg-gold' : 'bg-champagne/15'}`} />
      ))}
    </div>
  )
}
