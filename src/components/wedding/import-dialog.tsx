'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Download,
  RotateCcw,
  CheckCircle2,
  FileWarning,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   ImportDialog
   ------------------------------------------------------------
   Full-screen workflow dialog for the import engine:
     1. Upload    — drag/drop or pick a .xlsx / .csv
     2. Preview   — summary cards + per-row table + mapping
                    editor + error report download
     3. Confirm   — "Import N new + M updates?" → execute
     4. Result    — success message + "View in planner"

   API calls:
     POST /api/imports         (multipart: file + moduleKey)
     → { jobId, preview }
     POST /api/imports/[jobId] (JSON: { rowIndices? })
     → { result: ImportResult }

   Props:
     moduleKey   the worksheet module to import into
     isOpen      controlled open state
     onClose     close handler
     onComplete  optional callback when import succeeds — the
                 parent usually refetches the tab's data.
   ============================================================ */

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
  existingId?: string
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
  generatedAt: string
  fileFingerprint: string
}

interface ImportErrorEntry {
  row: number
  errors: string[]
}

interface ImportResult {
  jobId: string
  moduleKey: string
  created: number
  updated: number
  skipped: number
  errors: number
  errorReport: ImportErrorEntry[]
  rollbackToken: string
  executedAt: string
}

const ALLOWED_EXTS = ['.xlsx', '.csv']
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB cap (matches server)

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

export function ImportDialog({ moduleKey, isOpen, onClose, onComplete }: ImportDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [executing, setExecuting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const moduleLabel = MODULE_LABELS[moduleKey] ?? moduleKey

  // ── Reset state when the dialog opens ──
  useEffect(() => {
    if (isOpen) {
      setStep('upload')
      setFile(null)
      setJobId(null)
      setPreview(null)
      setResult(null)
      setError(null)
      setUploadProgress(0)
      setExecuting(false)
      setIsDragOver(false)
      setMappingOverrides({})
    }
  }, [isOpen])

  // ── Upload + parse + preview ──
  const handleUpload = useCallback(
    async (selected: File) => {
      setError(null)
      const ext = selected.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
      if (!ALLOWED_EXTS.includes(ext)) {
        setError(`File type "${ext || 'unknown'}" is not supported. Use .xlsx or .csv.`)
        return
      }
      if (selected.size > MAX_FILE_BYTES) {
        setError(
          `File is too large (${(selected.size / 1024 / 1024).toFixed(2)} MB). Max: 10 MB.`,
        )
        return
      }
      setFile(selected)
      setStep('preview')
      setUploadProgress(15)

      try {
        const form = new FormData()
        form.append('file', selected)
        form.append('moduleKey', moduleKey)

        setUploadProgress(45)

        const res = await fetch('/api/imports', {
          method: 'POST',
          body: form,
        })

        setUploadProgress(85)

        const json = (await res.json()) as {
          success: boolean
          jobId?: string
          preview?: ImportPreview
          error?: string
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? `Upload failed (${res.status})`)
        }
        if (!json.jobId || !json.preview) {
          throw new Error('Server returned an incomplete response.')
        }
        setJobId(json.jobId)
        setPreview(json.preview)
        setUploadProgress(100)
        // Tiny delay so the progress bar visibly completes
        setTimeout(() => setUploadProgress(0), 300)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setError(msg)
        setStep('upload')
        setFile(null)
        setUploadProgress(0)
      }
    },
    [moduleKey],
  )

  // ── Drag-and-drop handlers ──
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) void handleUpload(dropped)
    },
    [handleUpload],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0]
      if (picked) void handleUpload(picked)
      // Reset input so picking the same file twice triggers onChange
      e.target.value = ''
    },
    [handleUpload],
  )

  // ── Execute the import ──
  const handleExecute = useCallback(async () => {
    if (!jobId || !preview) return
    setExecuting(true)
    setError(null)
    try {
      const res = await fetch(`/api/imports/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as {
        success: boolean
        result?: ImportResult
        error?: string
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Execution failed (${res.status})`)
      }
      if (!json.result) throw new Error('Server returned no result.')
      setResult(json.result)
      setStep('result')
      toast({
        title: 'Import complete',
        description: `${json.result.created} created · ${json.result.updated} updated`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      setError(msg)
      toast({ title: 'Import failed', description: msg, variant: 'destructive' })
    } finally {
      setExecuting(false)
    }
  }, [jobId, preview, toast])

  // ── Reset to upload step (re-import) ──
  const handleReset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setJobId(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setUploadProgress(0)
    setMappingOverrides({})
  }, [])

  // ── Download error report (CSV of invalid rows) ──
  const downloadErrorReport = useCallback(() => {
    if (!preview) return
    const invalid = preview.rows.filter((r) => r.action === 'invalid' || r.errors.length > 0)
    if (invalid.length === 0) {
      toast({ title: 'No errors to download' })
      return
    }
    const lines: string[] = ['Row,Errors']
    for (const r of invalid) {
      const errs = r.errors.join('; ').replace(/"/g, '""')
      lines.push(`${r.rowIndex},"${errs}"`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wewed-${moduleKey}-import-errors-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [preview, moduleKey, toast])

  const handleClose = useCallback(() => {
    if (step === 'result') {
      onComplete?.()
    }
    onClose()
  }, [step, onComplete, onClose])

  // ── Derived data ──
  const previewStats = useMemo(() => {
    if (!preview) return null
    return {
      total: preview.totalRows,
      valid: preview.validRows,
      invalid: preview.invalidRows,
      newRec: preview.newRecords,
      updates: preview.updateRecords,
      duplicates: preview.duplicateRecords,
      skipped: preview.skippedRecords,
    }
  }, [preview])

  const hasBlockingErrors = useMemo(() => {
    if (!preview) return false
    return preview.missingRequired.length > 0 || preview.invalidRows === preview.totalRows
  }, [preview])

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[95vh] min-h-[600px] flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne sm:max-w-5xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <FileSpreadsheet className="size-4 text-gold" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg text-champagne">
                Import {moduleLabel}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-champagne/50">
                Upload a spreadsheet to bulk-import records. The file is parsed
                and previewed before anything is written.
              </DialogDescription>
            </div>
          </div>
          <StepIndicator step={step} />
        </div>

        {/* Body — the four steps */}
        <ScrollArea className="wewed-scroll min-h-0 flex-1">
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <UploadStep
                    isDragOver={isDragOver}
                    setIsDragOver={setIsDragOver}
                    onDrop={handleDrop}
                    onPickClick={() => fileInputRef.current?.click()}
                    error={error}
                    moduleLabel={moduleLabel}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </motion.div>
              )}

              {step === 'preview' && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <PreviewStep
                    preview={preview}
                    uploadProgress={uploadProgress}
                    error={error}
                    mappingOverrides={mappingOverrides}
                    setMappingOverrides={setMappingOverrides}
                    onDownloadErrors={downloadErrorReport}
                    onReset={handleReset}
                  />
                </motion.div>
              )}

              {step === 'confirm' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <ConfirmStep
                    preview={preview}
                    file={file}
                    moduleLabel={moduleLabel}
                  />
                </motion.div>
              )}

              {step === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <ResultStep
                    result={result}
                    moduleLabel={moduleLabel}
                    onViewInPlanner={handleClose}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer — contextual actions per step */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gold/15 bg-espresso/80 px-6 py-3">
          <div className="flex items-center gap-2 text-[11px] text-champagne/50">
            {file && (
              <span className="hidden items-center gap-1 sm:inline-flex">
                <FileSpreadsheet className="size-3 text-gold" />
                {file.name}
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1 text-clay-light">
                <AlertCircle className="size-3" />
                {error}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-champagne/60 hover:text-champagne"
              >
                <X className="size-3.5" /> Cancel
              </Button>
            )}

            {step === 'preview' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-champagne/60 hover:text-champagne"
                >
                  <ArrowLeft className="size-3.5" /> Upload different file
                </Button>
                <Button
                  size="sm"
                  disabled={!preview || hasBlockingErrors}
                  onClick={() => setStep('confirm')}
                  className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
                >
                  Continue
                  <ArrowRight className="size-3.5" />
                </Button>
              </>
            )}

            {step === 'confirm' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('preview')}
                  className="text-champagne/60 hover:text-champagne"
                >
                  <ArrowLeft className="size-3.5" /> Back to preview
                </Button>
                <Button
                  size="sm"
                  disabled={executing || !preview}
                  onClick={handleExecute}
                  className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
                >
                  {executing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Confirm & Import
                    </>
                  )}
                </Button>
              </>
            )}

            {step === 'result' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-gold/30 bg-transparent text-gold hover:bg-gold/10"
                >
                  <RefreshCw className="size-3.5" />
                  Import another
                </Button>
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="bg-gold text-espresso hover:bg-gold-light"
                >
                  <CheckCircle2 className="size-3.5" />
                  View in planner
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Step 1: Upload ──────────────────────────────────────────

interface UploadStepProps {
  isDragOver: boolean
  setIsDragOver: (v: boolean) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onPickClick: () => void
  error: string | null
  moduleLabel: string
}

function UploadStep({
  isDragOver,
  setIsDragOver,
  onDrop,
  onPickClick,
  error,
  moduleLabel,
}: UploadStepProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragOver
            ? 'border-gold bg-gold/10'
            : 'border-gold/30 bg-espresso/40 hover:border-gold/50 hover:bg-gold/5'
        }`}
      >
        <motion.div
          animate={isDragOver ? { scale: 1.05 } : { scale: 1 }}
          className="mb-3 flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10"
        >
          <Upload className="size-6 text-gold" />
        </motion.div>
        <p className="wewed-heading mb-1 text-lg text-champagne">
          Drop your {moduleLabel} spreadsheet here
        </p>
        <p className="mb-4 font-sans text-xs text-champagne/50">
          Excel (.xlsx) or CSV (.csv) — up to 10 MB
        </p>
        <Button
          type="button"
          size="sm"
          onClick={onPickClick}
          className="bg-gold text-espresso hover:bg-gold-light"
        >
          <FileSpreadsheet className="size-3.5" />
          Choose a file
        </Button>
        <p className="mt-4 max-w-sm font-sans text-[11px] text-champagne/40">
          Don&apos;t have a template yet? Use the{' '}
          <span className="text-gold">Template</span> button next to the Import
          button to download a properly formatted starting point.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-clay/30 bg-clay/10 p-3 text-clay-light">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="font-sans text-xs">{error}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TipCard
          icon={<FileSpreadsheet className="size-3.5" />}
          title="Use the template"
          body="Download the template first — column headers match what the importer expects."
        />
        <TipCard
          icon={<Sparkles className="size-3.5" />}
          title="Smart mapping"
          body="The importer auto-maps your columns to fields, even if headers differ slightly."
        />
        <TipCard
          icon={<RotateCcw className="size-3.5" />}
          title="Rollback supported"
          body="Every import produces a rollback token — you can reverse it if something looks wrong."
        />
      </div>
    </div>
  )
}

function TipCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-gold/15 bg-espresso/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-gold">
        {icon}
        <span className="font-sans text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="font-sans text-[11px] leading-relaxed text-champagne/60">{body}</p>
    </div>
  )
}

// ─── Step 2: Preview ─────────────────────────────────────────

interface PreviewStepProps {
  preview: ImportPreview | null
  uploadProgress: number
  error: string | null
  mappingOverrides: Record<string, string>
  setMappingOverrides: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  onDownloadErrors: () => void
  onReset: () => void
}

function PreviewStep({
  preview,
  uploadProgress,
  error,
  mappingOverrides,
  setMappingOverrides,
  onDownloadErrors,
  onReset,
}: PreviewStepProps) {
  if (uploadProgress > 0 && uploadProgress < 100) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="mb-3 flex items-center justify-center gap-2 text-gold">
          <Loader2 className="size-4 animate-spin" />
          <span className="font-sans text-sm">
            {uploadProgress < 50
              ? 'Reading file…'
              : uploadProgress < 90
              ? 'Parsing spreadsheet…'
              : 'Generating preview…'}
          </span>
        </div>
        <Progress
          value={uploadProgress}
          className="h-1.5 bg-champagne/10 [&>div]:bg-gradient-to-r [&>div]:from-gold-muted [&>div]:to-gold"
        />
        <p className="mt-2 text-center font-sans text-[11px] text-champagne/40">
          Large files take a moment — we validate every row.
        </p>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <AlertCircle className="size-6 text-clay-light" />
        <p className="font-sans text-sm text-champagne/70">
          {error ?? 'No preview available. Try uploading again.'}
        </p>
        <Button variant="outline" size="sm" onClick={onReset}>
          <ArrowLeft className="size-3.5" /> Back to upload
        </Button>
      </div>
    )
  }

  const hasErrors = preview.invalidRows > 0
  const hasWarnings =
    preview.unmappedColumns.length > 0 || preview.missingRequired.length > 0

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total rows" value={preview.totalRows} tint="text-champagne" />
        <SummaryCard label="New" value={preview.newRecords} tint="text-sage-light" icon={<Check className="size-3" />} />
        <SummaryCard label="Updates" value={preview.updateRecords} tint="text-gold" icon={<RefreshCw className="size-3" />} />
        <SummaryCard label="Skipped" value={preview.skippedRecords} tint="text-champagne/60" />
        <SummaryCard label="Duplicates" value={preview.duplicateRecords} tint="text-gold-muted" />
        <SummaryCard label="Invalid" value={preview.invalidRows} tint={preview.invalidRows > 0 ? 'text-clay-light' : 'text-champagne/60'} icon={preview.invalidRows > 0 ? <AlertCircle className="size-3" /> : undefined} />
      </div>

      {/* Validation warnings */}
      {(hasWarnings || hasErrors) && (
        <div className="space-y-2">
          {preview.missingRequired.length > 0 && (
            <WarningBanner
              variant="error"
              title="Required fields missing"
              body={`These required fields have no matching column in your file: ${preview.missingRequired.join(', ')}. Add a column with one of these headers (or a close variant) and re-upload.`}
            />
          )}
          {preview.unmappedColumns.length > 0 && (
            <WarningBanner
              variant="warn"
              title="Unmapped columns"
              body={`These columns were not recognized and will be ignored: ${preview.unmappedColumns.join(', ')}.`}
            />
          )}
          {hasErrors && (
            <WarningBanner
              variant="error"
              title={`${preview.invalidRows} row${preview.invalidRows === 1 ? '' : 's'} with errors`}
              body="Rows with errors will be skipped during import. Download the error report for details, fix the rows in your file, and re-upload."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownloadErrors}
                  className="border-clay/40 bg-transparent text-clay-light hover:bg-clay/10"
                >
                  <Download className="size-3.5" />
                  Error report
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Field mapping */}
      <FieldMappingEditor
        preview={preview}
        overrides={mappingOverrides}
        setOverrides={setMappingOverrides}
      />

      {/* Per-row table */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
            Row preview (showing first 50)
          </p>
          <p className="font-sans text-[10px] text-champagne/40">
            {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} parsed
          </p>
        </div>
        <div className="rounded-md border border-gold/15 bg-espresso/40">
          <ScrollArea className="wewed-scroll max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-gold/15 hover:bg-transparent">
                  <TableHead className="w-[60px] text-[10px] uppercase text-gold-muted">Row</TableHead>
                  <TableHead className="w-[100px] text-[10px] uppercase text-gold-muted">Action</TableHead>
                  {Object.keys(preview.fieldMapping).slice(0, 4).map((col) => (
                    <TableHead key={col} className="text-[10px] uppercase text-gold-muted">
                      {col}
                    </TableHead>
                  ))}
                  <TableHead className="text-[10px] uppercase text-gold-muted">Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.slice(0, 50).map((row) => (
                  <TableRow
                    key={row.rowIndex}
                    className="border-gold/10 text-champagne/80 data-[state=selected]:bg-gold/10"
                  >
                    <TableCell className="font-mono text-[11px] text-champagne/50">{row.rowIndex}</TableCell>
                    <TableCell>
                      <ActionBadge action={row.action} />
                    </TableCell>
                    {Object.keys(preview.fieldMapping).slice(0, 4).map((col) => (
                      <TableCell key={col} className="max-w-[200px] truncate font-sans text-xs">
                        {row.raw[col] ?? '—'}
                      </TableCell>
                    ))}
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] text-clay-light">
                          <AlertCircle className="size-3" />
                          {row.errors.length} error{row.errors.length === 1 ? '' : 's'}
                        </span>
                      ) : row.warnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gold">
                          <FileWarning className="size-3" />
                          {row.warnings.length}
                        </span>
                      ) : (
                        <span className="text-sage-light">
                          <Check className="size-3" />
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        {preview.rows.length > 50 && (
          <p className="mt-2 text-center font-sans text-[10px] text-champagne/40">
            Showing 50 of {preview.rows.length} rows. All rows will be processed on import.
          </p>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tint,
  icon,
}: {
  label: string
  value: number
  tint: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gold/15 bg-espresso/40 p-3">
      <div className="flex items-center gap-1">
        {icon && <span className={tint}>{icon}</span>}
        <span className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">
          {label}
        </span>
      </div>
      <p className={`mt-1 wewed-heading text-xl ${tint}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function WarningBanner({
  variant,
  title,
  body,
  action,
}: {
  variant: 'warn' | 'error'
  title: string
  body: string
  action?: React.ReactNode
}) {
  const isErr = variant === 'error'
  return (
    <div
      className={`flex flex-wrap items-start gap-3 rounded-md border p-3 ${
        isErr
          ? 'border-clay/30 bg-clay/10 text-clay-light'
          : 'border-gold/30 bg-gold/10 text-gold'
      }`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider">{title}</p>
        <p className="mt-0.5 font-sans text-[11px] leading-relaxed text-champagne/70">{body}</p>
      </div>
      {action}
    </div>
  )
}

function ActionBadge({ action }: { action: RowAction['action'] }) {
  const styles: Record<RowAction['action'], string> = {
    create: 'border-sage/40 bg-sage/10 text-sage-light',
    update: 'border-gold/40 bg-gold/15 text-gold',
    skip: 'border-champagne/20 bg-champagne/5 text-champagne/60',
    invalid: 'border-clay/40 bg-clay/15 text-clay-light',
  }
  const icons: Record<RowAction['action'], React.ReactNode> = {
    create: <Check className="size-2.5" />,
    update: <RefreshCw className="size-2.5" />,
    skip: <X className="size-2.5" />,
    invalid: <AlertCircle className="size-2.5" />,
  }
  return (
    <Badge
      variant="outline"
      className={`gap-1 border px-1.5 py-0 text-[9px] uppercase tracking-wider ${styles[action]}`}
    >
      {icons[action]}
      {action}
    </Badge>
  )
}

function FieldMappingEditor({
  preview,
  overrides,
  setOverrides,
}: {
  preview: ImportPreview
  overrides: Record<string, string>
  setOverrides: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const sourceColumns = Object.keys(preview.fieldMapping)
  if (sourceColumns.length === 0) return null

  // All possible target fields (the mapped values + any unmapped fields
  // the user might want to manually point a column at).
  const allTargets = Array.from(
    new Set([
      ...Object.values(preview.fieldMapping),
      ...preview.missingRequired,
    ]),
  ).filter(Boolean)

  return (
    <div className="rounded-md border border-gold/15 bg-espresso/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
          Field mapping
        </p>
        <span className="font-sans text-[10px] text-champagne/40">
          Auto-detected — adjust if needed
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sourceColumns.map((col) => {
          const auto = preview.fieldMapping[col] ?? ''
          const current = overrides[col] ?? auto
          return (
            <div
              key={col}
              className="flex items-center gap-2 rounded-md border border-gold/10 bg-espresso/60 px-2 py-1.5"
            >
              <span className="flex-1 truncate font-sans text-xs text-champagne/80" title={col}>
                {col}
              </span>
              <ArrowRight className="size-3 shrink-0 text-gold/50" />
              <Select
                value={current || '__none__'}
                onValueChange={(v) =>
                  setOverrides((prev) => ({
                    ...prev,
                    [col]: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger size="sm" className="h-7 w-[140px] border-gold/30 bg-espresso/80 text-[11px] text-champagne">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gold/30 bg-espresso text-champagne">
                  <SelectItem value="__none__" className="text-[11px] text-champagne/50 focus:bg-gold/10">
                    — ignore —
                  </SelectItem>
                  {allTargets.map((target) => (
                    <SelectItem
                      key={target}
                      value={target}
                      className="text-[11px] text-champagne focus:bg-gold/10 focus:text-gold"
                    >
                      {target}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      {preview.unmappedColumns.length > 0 && (
        <p className="mt-2 font-sans text-[10px] text-champagne/40">
          Unmapped columns: {preview.unmappedColumns.join(', ')}
        </p>
      )}
    </div>
  )
}

// ─── Step 3: Confirm ─────────────────────────────────────────

function ConfirmStep({
  preview,
  file,
  moduleLabel,
}: {
  preview: ImportPreview | null
  file: File | null
  moduleLabel: string
}) {
  if (!preview) return null
  const total = preview.newRecords + preview.updateRecords
  return (
    <div className="mx-auto max-w-xl py-4">
      <div className="rounded-lg border border-gold/30 bg-gold/5 p-6 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
        >
          <Check className="size-6 text-gold" />
        </motion.div>
        <p className="wewed-heading text-xl text-champagne">
          Ready to import {total.toLocaleString()} {moduleLabel.toLowerCase()} record{total === 1 ? '' : 's'}
        </p>
        <p className="mt-1 font-sans text-xs text-champagne/60">
          {preview.newRecords > 0 && (
            <>
              <span className="text-sage-light">{preview.newRecords} new</span>
              {preview.updateRecords > 0 && <span className="text-champagne/40"> · </span>}
            </>
          )}
          {preview.updateRecords > 0 && (
            <span className="text-gold">{preview.updateRecords} update{preview.updateRecords === 1 ? '' : 's'}</span>
          )}
          {preview.skippedRecords > 0 && (
            <>
              <span className="text-champagne/40"> · </span>
              <span className="text-champagne/60">{preview.skippedRecords} skipped</span>
            </>
          )}
          {preview.invalidRows > 0 && (
            <>
              <span className="text-champagne/40"> · </span>
              <span className="text-clay-light">{preview.invalidRows} invalid</span>
            </>
          )}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <Row label="Source file" value={file?.name ?? preview.fileName} />
        <Row label="Template version" value={`v${preview.templateVersion}`} />
        <Row
          label="Rollback"
          value="Available — every import can be undone"
          valueClass="text-sage-light"
        />
        <Row
          label="Audit trail"
          value="Logged to AuditEvent with before/after values"
          valueClass="text-sage-light"
        />
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-md border border-gold/20 bg-espresso/40 p-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-gold" />
        <p className="font-sans text-[11px] leading-relaxed text-champagne/60">
          This action writes to your live database. If something looks off after
          the import, use the rollback token from the result step to reverse it.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, valueClass = 'text-champagne/80' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gold/10 bg-espresso/40 px-3 py-2">
      <span className="font-sans text-[10px] uppercase tracking-wider text-gold-muted">{label}</span>
      <span className={`font-sans text-xs ${valueClass}`}>{value}</span>
    </div>
  )
}

// ─── Step 4: Result ──────────────────────────────────────────

function ResultStep({
  result,
  moduleLabel,
  onViewInPlanner,
}: {
  result: ImportResult | null
  moduleLabel: string
  onViewInPlanner: () => void
}) {
  if (!result) return null
  const total = result.created + result.updated
  const hasErrors = result.errors > 0
  return (
    <div className="mx-auto max-w-xl py-4">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-lg border border-sage/30 bg-sage/5 p-6 text-center"
      >
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border border-sage/40 bg-sage/10">
          <CheckCircle2 className="size-7 text-sage-light" />
        </div>
        <p className="wewed-heading text-2xl text-champagne">
          {total.toLocaleString()} {moduleLabel.toLowerCase()} record{total === 1 ? '' : 's'} imported
        </p>
        <p className="mt-1 font-sans text-xs text-champagne/60">
          {result.created > 0 && (
            <>
              <span className="text-sage-light">{result.created} new</span>
              {result.updated > 0 && <span className="text-champagne/40"> · </span>}
            </>
          )}
          {result.updated > 0 && (
            <span className="text-gold">{result.updated} updated</span>
          )}
          {result.skipped > 0 && (
            <>
              <span className="text-champagne/40"> · </span>
              <span className="text-champagne/60">{result.skipped} skipped</span>
            </>
          )}
          {hasErrors && (
            <>
              <span className="text-champagne/40"> · </span>
              <span className="text-clay-light">{result.errors} with errors</span>
            </>
          )}
        </p>
      </motion.div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <StatBox label="Created" value={result.created} tint="text-sage-light" />
        <StatBox label="Updated" value={result.updated} tint="text-gold" />
        <StatBox label="Skipped" value={result.skipped} tint="text-champagne/60" />
        <StatBox label="Errors" value={result.errors} tint={hasErrors ? 'text-clay-light' : 'text-champagne/60'} />
      </div>

      <div className="mt-5 rounded-md border border-gold/20 bg-espresso/40 p-3">
        <p className="mb-1 font-sans text-[10px] uppercase tracking-wider text-gold-muted">
          Rollback token (saved)
        </p>
        <code className="block break-all font-mono text-[11px] text-gold/80">
          {result.rollbackToken}
        </code>
        <p className="mt-2 font-sans text-[10px] text-champagne/40">
          Keep this token to reverse the import. The recent-imports list also
          stores it server-side.
        </p>
      </div>

      {hasErrors && result.errorReport.length > 0 && (
        <div className="mt-4 rounded-md border border-clay/30 bg-clay/10 p-3 text-clay-light">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider">
            {result.errorReport.length} row{result.errorReport.length === 1 ? '' : 's'} failed
          </p>
          <ul className="mt-2 space-y-1">
            {result.errorReport.slice(0, 5).map((e) => (
              <li key={e.row} className="font-sans text-[11px]">
                <span className="font-mono text-gold">Row {e.row}:</span>{' '}
                {e.errors.join('; ')}
              </li>
            ))}
            {result.errorReport.length > 5 && (
              <li className="font-sans text-[10px] text-champagne/40">
                + {result.errorReport.length - 5} more — check server logs.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-2">
        <Button onClick={onViewInPlanner} className="bg-gold text-espresso hover:bg-gold-light">
          <CheckCircle2 className="size-4" />
          View in planner
        </Button>
      </div>
    </div>
  )
}

function StatBox({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="rounded-md border border-gold/15 bg-espresso/40 p-3 text-center">
      <p className={`wewed-heading text-2xl ${tint}`}>{value.toLocaleString()}</p>
      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">
        {label}
      </p>
    </div>
  )
}

// ─── Step indicator ──────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string; n: number }[] = [
    { key: 'upload', label: 'Upload', n: 1 },
    { key: 'preview', label: 'Preview', n: 2 },
    { key: 'confirm', label: 'Confirm', n: 3 },
    { key: 'result', label: 'Done', n: 4 },
  ]
  const activeIdx = steps.findIndex((s) => s.key === step)
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {steps.map((s, i) => {
        const isPast = i < activeIdx
        const isActive = i === activeIdx
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors ${
                isPast
                  ? 'border-sage/40 bg-sage/15 text-sage-light'
                  : isActive
                  ? 'border-gold bg-gold/20 text-gold'
                  : 'border-champagne/20 bg-espresso/60 text-champagne/40'
              }`}
            >
              {isPast ? <Check className="size-3" /> : s.n}
            </div>
            <span
              className={`font-sans text-[10px] uppercase tracking-wider ${
                isActive ? 'text-gold' : isPast ? 'text-sage-light' : 'text-champagne/40'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`mx-1 h-px w-4 ${isPast ? 'bg-sage/40' : 'bg-champagne/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
