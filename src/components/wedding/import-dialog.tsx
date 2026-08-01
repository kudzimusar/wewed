'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
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
  const blocking = Boolean(preview && (preview.missingRequired.length || preview.validRows === 0))

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
      <DialogContent className="flex max-h-[94vh] min-h-[620px] max-w-5xl flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne">
        <div className="border-b border-gold/15 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl"><FileSpreadsheet className="size-5 text-gold" />Import {moduleLabel}</DialogTitle>
          <DialogDescription className="mt-1 text-champagne/50">Preview, correct field mapping, confirm and retain a persistent rollback.</DialogDescription>
          <StepBar step={step} />
        </div>

        {progress > 0 && <Progress value={progress} className="rounded-none" />}
        {error && <div className="mx-6 mt-4 flex items-center gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay-light"><AlertCircle className="size-4" />{error}</div>}

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">
            {step === 'upload' && (
              <div className="mx-auto max-w-xl rounded-xl border border-dashed border-gold/35 bg-gold/5 p-10 text-center">
                <Upload className="mx-auto size-10 text-gold" />
                <h3 className="mt-4 text-lg">Upload {moduleLabel} spreadsheet</h3>
                <p className="mt-2 text-sm text-champagne/50">Accepted formats: .xlsx and .csv, up to 10 MB.</p>
                <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void upload(selected); event.target.value = '' }} />
                <Button className="mt-5 bg-gold text-espresso hover:bg-gold-light" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Choose file</Button>
              </div>
            )}

            {step === 'preview' && preview && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <Stat label="Rows" value={preview.totalRows} />
                  <Stat label="Create" value={preview.newRecords} />
                  <Stat label="Update" value={preview.updateRecords} />
                  <Stat label="Skip" value={preview.skippedRecords} />
                  <Stat label="Invalid" value={preview.invalidRows} warning={preview.invalidRows > 0} />
                  <Stat label="Duplicates" value={preview.duplicateRecords} />
                </div>

                <div className="rounded-md border border-gold/15 bg-espresso/45 p-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Field mapping</h3><span className="text-[10px] text-champagne/45">Changes are revalidated before execution</span></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sourceColumns.map((source) => {
                      const value = mappingOverrides[source] ?? preview.fieldMapping[source] ?? ''
                      return <div key={source} className="flex items-center gap-2 rounded-md border border-gold/10 px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-xs">{source}</span><ArrowRight className="size-3 text-gold/50" /><Select value={value || '__ignore__'} onValueChange={(target) => setMappingOverrides((current) => ({ ...current, [source]: target === '__ignore__' ? '' : target }))}><SelectTrigger className="h-8 w-36 border-gold/25 bg-espresso/60 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__ignore__">Ignore</SelectItem>{targetFields.map((target) => <SelectItem key={target} value={target}>{target}</SelectItem>)}</SelectContent></Select></div>
                    })}
                  </div>
                  {preview.missingRequired.length > 0 && <p className="mt-3 text-xs text-clay-light">Missing required mapping: {preview.missingRequired.join(', ')}</p>}
                </div>

                <div className="rounded-md border border-gold/15">
                  <ScrollArea className="max-h-[360px]">
                    <Table>
                      <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Action</TableHead>{sourceColumns.slice(0, 4).map((column) => <TableHead key={column}>{column}</TableHead>)}<TableHead>Issues</TableHead></TableRow></TableHeader>
                      <TableBody>{preview.rows.slice(0, 100).map((row) => <TableRow key={row.rowIndex}><TableCell>{row.rowIndex}</TableCell><TableCell><Action action={row.action} /></TableCell>{sourceColumns.slice(0, 4).map((column) => <TableCell key={column} className="max-w-40 truncate">{row.raw[column] || '—'}</TableCell>)}<TableCell className={row.errors.length ? 'text-clay-light' : 'text-champagne/45'}>{row.errors.length ? row.errors.join('; ') : row.warnings.join('; ') || 'Ready'}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            )}

            {step === 'confirm' && preview && (
              <div className="mx-auto max-w-xl rounded-xl border border-gold/25 bg-gold/5 p-8 text-center">
                <CheckCircle2 className="mx-auto size-12 text-gold" />
                <h3 className="mt-4 text-xl">Import {preview.newRecords + preview.updateRecords} records?</h3>
                <p className="mt-2 text-sm text-champagne/55">{preview.newRecords} new · {preview.updateRecords} updates · {preview.skippedRecords} skipped · {preview.invalidRows} invalid</p>
                <p className="mt-4 text-xs text-champagne/45">The preview and rollback snapshot are stored against the active wedding and survive a server restart.</p>
              </div>
            )}

            {step === 'result' && result && (
              <div className="mx-auto max-w-xl space-y-5">
                <div className={`rounded-xl border p-8 text-center ${rolledBack ? 'border-gold/30 bg-gold/5' : 'border-sage/30 bg-sage/5'}`}>
                  {rolledBack ? <RotateCcw className="mx-auto size-12 text-gold" /> : <CheckCircle2 className="mx-auto size-12 text-sage-light" />}
                  <h3 className="mt-4 text-xl">{rolledBack ? 'Import rolled back' : 'Import completed'}</h3>
                  <p className="mt-2 text-sm text-champagne/55">{result.created} created · {result.updated} updated · {result.skipped} skipped · {result.errors} errors</p>
                </div>
                {!rolledBack && <Button variant="outline" className="w-full border-clay/30 bg-transparent text-clay-light" disabled={busy} onClick={() => void rollback()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Roll back this import</Button>}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-gold/15 px-6 py-4">
          <div>{step === 'preview' && preview.invalidRows > 0 && <Button variant="ghost" size="sm" onClick={downloadErrors}><Download className="size-4" />Error CSV</Button>}</div>
          <div className="flex gap-2">
            {step !== 'upload' && step !== 'result' && <Button variant="outline" disabled={busy} onClick={() => setStep(step === 'confirm' ? 'preview' : 'upload')} className="border-gold/25 bg-transparent"><ArrowLeft className="size-4" />Back</Button>}
            {step === 'preview' && <Button disabled={busy || blocking} onClick={() => setStep('confirm')} className="bg-gold text-espresso hover:bg-gold-light">Review import<ArrowRight className="size-4" /></Button>}
            {step === 'confirm' && <Button disabled={busy} onClick={() => void execute()} className="bg-gold text-espresso hover:bg-gold-light">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Import now</Button>}
            {step === 'result' && <Button onClick={close} className="bg-gold text-espresso hover:bg-gold-light">View in planner</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
function Action({ action }: { action: RowAction['action'] }) { return <Badge variant="outline" className={action === 'invalid' ? 'border-clay/30 text-clay-light' : action === 'create' ? 'border-sage/30 text-sage-light' : 'border-gold/25 text-gold'}>{action}</Badge> }
function StepBar({ step }: { step: Step }) { const steps: Step[] = ['upload', 'preview', 'confirm', 'result']; const index = steps.indexOf(step); return <div className="mt-3 flex gap-1">{steps.map((item, itemIndex) => <div key={item} className={`h-1 flex-1 rounded ${itemIndex <= index ? 'bg-gold' : 'bg-champagne/15'}`} />)}</div> }
