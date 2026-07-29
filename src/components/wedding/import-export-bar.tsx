'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/wedding/import-dialog'
import { useToast } from '@/hooks/use-toast'
import { worksheetPermissionCapabilities } from '@/lib/planner-client-permissions'

interface ImportExportBarProps {
  moduleKey: string
  onImportComplete?: () => void
  className?: string
}

interface PlannerSessionPayload {
  authorized?: boolean
  activeWedding?: {
    membershipRole?: 'admin' | 'owner' | 'planner' | 'coordinator' | 'viewer'
    permissions?: string[]
  }
}

interface ImportJobSummary {
  id: string
  moduleKey: string
  fileName: string
  templateVersion: string | null
  status: string
  totalRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  errorReport: string | null
  rollbackToken: string | null
  createdAt: string
  updatedAt: string
}

const VALID_MODULE_LABELS: Record<string, string> = {
  guests: 'Guests',
  budget: 'Budget',
  checklist: 'Checklist',
  seating: 'Seating',
  vendors: 'Vendors',
  timeline: 'Timeline',
  songs: 'Songs',
  'wedding-party': 'Wedding Party',
  travel: 'Travel',
  media: 'Media',
}

function roleLabel(value?: string): string {
  if (!value) return 'Wedding access'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function statusClass(status: string): string {
  if (status === 'completed' || status === 'rolled_back') {
    return 'border-sage/30 text-sage-light'
  }
  if (status === 'failed' || status === 'rollback_failed') {
    return 'border-clay/35 text-clay-light'
  }
  if (status === 'preview') return 'border-gold/25 text-gold'
  return 'border-champagne/20 text-champagne/55'
}

export function ImportExportBar({
  moduleKey,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {
  const { toast } = useToast()
  const [session, setSession] = useState<PlannerSessionPayload | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [jobs, setJobs] = useState<ImportJobSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [rollbackJobId, setRollbackJobId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'template' | 'export' | null>(null)

  const loadPermissions = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const payload = (await response.json()) as PlannerSessionPayload
      setSession(response.ok && payload.authorized ? payload : null)
    } catch {
      setSession(null)
    } finally {
      setPermissionsLoaded(true)
    }
  }, [])

  useEffect(() => {
    void loadPermissions()
    window.addEventListener('focus', loadPermissions)
    window.addEventListener('wewed:wedding-switched', loadPermissions)
    return () => {
      window.removeEventListener('focus', loadPermissions)
      window.removeEventListener('wewed:wedding-switched', loadPermissions)
    }
  }, [loadPermissions])

  useEffect(() => {
    const clearWorksheetState = () => {
      setJobs([])
      setHistoryOpen(false)
      setImportOpen(false)
    }
    window.addEventListener('wewed:wedding-switched', clearWorksheetState)
    return () => window.removeEventListener('wewed:wedding-switched', clearWorksheetState)
  }, [])

  const moduleLabel = VALID_MODULE_LABELS[moduleKey] ?? moduleKey
  const capabilities = useMemo(
    () => worksheetPermissionCapabilities(session?.activeWedding?.permissions),
    [session],
  )

  const loadHistory = useCallback(
    async (showError = true) => {
      if (!capabilities.canImportWorksheet) return
      setHistoryLoading(true)
      try {
        const response = await fetch(
          `/api/imports?module=${encodeURIComponent(moduleKey)}&limit=8`,
          { cache: 'no-store' },
        )
        const payload = (await response.json()) as {
          success?: boolean
          data?: ImportJobSummary[]
          error?: string
        }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to load import history.')
        }
        setJobs(payload.data ?? [])
      } catch (error) {
        if (showError) {
          toast({
            title: 'Import history unavailable',
            description: error instanceof Error ? error.message : undefined,
            variant: 'destructive',
          })
        }
      } finally {
        setHistoryLoading(false)
      }
    },
    [capabilities.canImportWorksheet, moduleKey, toast],
  )

  const triggerDownload = useCallback(
    async (endpoint: 'template' | 'export') => {
      const permitted =
        endpoint === 'template'
          ? capabilities.canDownloadWorksheetTemplate
          : capabilities.canExportWorksheet
      if (!permitted) {
        toast({
          title: 'Permission required',
          description:
            endpoint === 'template'
              ? 'This wedding role cannot download import templates.'
              : 'This wedding role cannot export planner data.',
          variant: 'destructive',
        })
        return
      }

      setDownloading(endpoint === 'template' ? 'template' : 'export')
      try {
        const url =
          endpoint === 'template'
            ? `/api/templates?module=${encodeURIComponent(moduleKey)}`
            : `/api/exports?module=${encodeURIComponent(moduleKey)}&format=xlsx`
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) {
          let message = `Failed (${response.status})`
          try {
            const payload = (await response.json()) as { error?: string }
            if (payload.error) message = payload.error
          } catch {
            // The endpoint may return a non-JSON error response.
          }
          throw new Error(message)
        }

        const blob = await response.blob()
        const contentDisposition = response.headers.get('Content-Disposition') ?? ''
        const match = contentDisposition.match(/filename="?([^";]+)"?/i)
        const filename =
          match?.[1] ??
          (endpoint === 'template'
            ? `wewed-${moduleKey}-template.xlsx`
            : `wewed-${moduleKey}-export.xlsx`)
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(objectUrl)

        toast({
          title: endpoint === 'template' ? 'Template downloaded' : 'Export ready',
          description:
            endpoint === 'template'
              ? `${moduleLabel} template — fill it in and import.`
              : `${moduleLabel} exported to Excel.`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed'
        toast({
          title: endpoint === 'template' ? 'Template failed' : 'Export failed',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setDownloading(null)
      }
    },
    [capabilities, moduleKey, moduleLabel, toast],
  )

  const openImport = useCallback(() => {
    if (!capabilities.canImportWorksheet) {
      toast({
        title: 'Permission required',
        description: 'This wedding role cannot import planner data.',
        variant: 'destructive',
      })
      return
    }
    setImportOpen(true)
  }, [capabilities.canImportWorksheet, toast])

  const handleImportComplete = useCallback(() => {
    onImportComplete?.()
    void loadHistory(false)
  }, [loadHistory, onImportComplete])

  const toggleHistory = useCallback(() => {
    setHistoryOpen((current) => {
      const next = !current
      if (next) void loadHistory()
      return next
    })
  }, [loadHistory])

  const rollbackImport = useCallback(
    async (job: ImportJobSummary) => {
      if (!capabilities.canImportWorksheet || !job.rollbackToken) return
      if (
        !window.confirm(
          `Rollback the ${moduleLabel} import from “${job.fileName}”? Created rows will be removed and updated rows restored.`,
        )
      ) {
        return
      }

      setRollbackJobId(job.id)
      try {
        const response = await fetch(`/api/imports/${job.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rollback',
            rollbackToken: job.rollbackToken,
          }),
          cache: 'no-store',
        })
        const payload = (await response.json()) as { success?: boolean; error?: string }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to rollback this import.')
        }
        toast({
          title: 'Import rolled back',
          description: `${moduleLabel} records were restored to their pre-import state.`,
        })
        onImportComplete?.()
        await loadHistory(false)
      } catch (error) {
        toast({
          title: 'Rollback failed',
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        })
      } finally {
        setRollbackJobId(null)
      }
    },
    [capabilities.canImportWorksheet, loadHistory, moduleLabel, onImportComplete, toast],
  )

  if (!permissionsLoaded || !capabilities.canUseWorksheetTools) return null

  return (
    <>
      <div className={`rounded-xl border border-gold/15 bg-espresso/35 p-3 ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2"
        >
          <Badge
            variant="outline"
            className="hidden border-gold/30 bg-gold/10 text-[10px] uppercase tracking-wider text-gold sm:inline-flex"
          >
            <FileSpreadsheet className="mr-1 size-3" />
            {moduleLabel} data
          </Badge>

          {capabilities.canDownloadWorksheetTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => triggerDownload('template')}
              className="gap-1.5 border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold disabled:opacity-40"
            >
              {downloading === 'template' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span className="hidden sm:inline">Template</span>
              <span className="sm:hidden">.xlsx</span>
            </Button>
          )}

          {capabilities.canExportWorksheet && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => triggerDownload('export')}
              className="gap-1.5 border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold disabled:opacity-40"
            >
              {downloading === 'export' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5" />
              )}
              <span>Export</span>
            </Button>
          )}

          {capabilities.canImportWorksheet && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={openImport}
                className="gap-1.5 bg-gold text-espresso hover:bg-gold-light"
              >
                <Upload className="size-3.5" />
                <span>Import</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleHistory}
                className="gap-1.5 text-champagne/55 hover:bg-gold/10 hover:text-gold"
              >
                <History className="size-3.5" />
                Recent imports
                {historyOpen ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </Button>
            </>
          )}

          <span
            className="ml-auto hidden items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-champagne/40 md:inline-flex"
            title="Actions are controlled by the selected wedding's permissions"
          >
            <ShieldCheck className="size-3" />
            {roleLabel(session?.activeWedding?.membershipRole)}
          </span>
        </motion.div>

        {capabilities.canImportWorksheet && historyOpen && (
          <div className="mt-3 border-t border-gold/10 pt-3">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-3 font-sans text-xs text-champagne/45">
                <Loader2 className="size-4 animate-spin text-gold" /> Loading import history…
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-2 font-sans text-xs text-champagne/45">
                No imports have been run for this module in the selected wedding.
              </p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-gold/10 bg-espresso/45 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-sans text-xs font-medium text-champagne/80">
                          {job.fileName}
                        </p>
                        <p className="font-sans text-[10px] text-champagne/35">
                          {dateTime(job.updatedAt)} · {job.totalRows} rows · {job.createdCount}{' '}
                          created · {job.updatedCount} updated · {job.skippedCount} skipped
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[9px] ${statusClass(job.status)}`}>
                          {statusLabel(job.status)}
                        </Badge>
                        {job.status === 'completed' && job.rollbackToken && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={rollbackJobId !== null}
                            onClick={() => rollbackImport(job)}
                            className="h-7 gap-1 px-2 text-[10px] text-champagne/50 hover:bg-clay/10 hover:text-clay-light"
                          >
                            {rollbackJobId === job.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Rollback
                          </Button>
                        )}
                      </div>
                    </div>
                    {job.errorCount > 0 && job.errorReport && (
                      <details className="mt-2 rounded-md border border-clay/15 bg-clay/5 px-2 py-1.5">
                        <summary className="cursor-pointer font-sans text-[10px] text-clay-light">
                          <AlertTriangle className="mr-1 inline size-3" />
                          {job.errorCount} import error{job.errorCount === 1 ? '' : 's'}
                        </summary>
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[9px] text-champagne/55">
                          {job.errorReport}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {capabilities.canImportWorksheet && (
        <ImportDialog
          moduleKey={moduleKey}
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onComplete={handleImportComplete}
        />
      )}
    </>
  )
}
