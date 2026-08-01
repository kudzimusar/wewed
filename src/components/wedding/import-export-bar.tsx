'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { PlannerToolSlug } from '@/lib/planner-route-state'

interface ImportExportBarProps {
  moduleKey: string
  routeTool?: PlannerToolSlug | null
  onRouteToolChange?: (tool: PlannerToolSlug | null) => void
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
  if (status === 'executed' || status === 'rolled_back') {
    return 'border-sage/30 text-sage-light'
  }
  if (status === 'failed' || status === 'rollback_failed') {
    return 'border-clay/35 text-clay-light'
  }
  if (status === 'preview') return 'border-gold/25 text-gold'
  return 'border-champagne/20 text-champagne/55'
}

function errorSummary(job: ImportJobSummary): string | null {
  if (!job.errorCount) return null
  if (!job.errorReport) return `${job.errorCount} row error${job.errorCount === 1 ? '' : 's'}`
  try {
    const report = JSON.parse(job.errorReport) as Array<{ row?: number; errors?: string[] }>
    const first = report[0]
    if (!first) return `${job.errorCount} row error${job.errorCount === 1 ? '' : 's'}`
    const detail = first.errors?.join('; ') || 'Invalid row'
    return `Row ${first.row ?? '?'}: ${detail}${report.length > 1 ? ` · ${report.length - 1} more` : ''}`
  } catch {
    return `${job.errorCount} row error${job.errorCount === 1 ? '' : 's'}`
  }
}

export function ImportExportBar({
  moduleKey,
  routeTool,
  onRouteToolChange,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {
  const { toast } = useToast()
  const [session, setSession] = useState<PlannerSessionPayload | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [localImportOpen, setLocalImportOpen] = useState(false)
  const [localHistoryOpen, setLocalHistoryOpen] = useState(false)
  const routeControlled = routeTool !== undefined
  const importOpen = routeControlled ? routeTool === 'import' : localImportOpen
  const historyOpen = routeControlled ? routeTool === 'imports' : localHistoryOpen
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
      setLocalHistoryOpen(false)
      setLocalImportOpen(false)
      if (routeControlled) onRouteToolChange?.(null)
    }
    window.addEventListener('wewed:wedding-switched', clearWorksheetState)
    return () => window.removeEventListener('wewed:wedding-switched', clearWorksheetState)
  }, [onRouteToolChange, routeControlled])

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

      setDownloading(endpoint)
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
            // Some download failures are not JSON responses.
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
        toast({
          title: endpoint === 'template' ? 'Template failed' : 'Export failed',
          description: error instanceof Error ? error.message : 'Download failed',
          variant: 'destructive',
        })
      } finally {
        setDownloading(null)
      }
    },
    [capabilities, moduleKey, moduleLabel, toast],
  )

  const setRouteTool = useCallback(
    (tool: PlannerToolSlug | null) => {
      if (routeControlled) {
        onRouteToolChange?.(tool)
        return
      }
      setLocalImportOpen(tool === 'import')
      setLocalHistoryOpen(tool === 'imports')
    },
    [onRouteToolChange, routeControlled],
  )

  const handleImportComplete = useCallback(() => {
    onImportComplete?.()
    void loadHistory(false)
  }, [loadHistory, onImportComplete])

  const toggleHistory = useCallback(() => {
    setRouteTool(historyOpen ? null : 'imports')
  }, [historyOpen, setRouteTool])

  useEffect(() => {
    if (historyOpen) void loadHistory(false)
  }, [historyOpen, loadHistory])

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
        const response = await fetch(
          `/api/imports/${encodeURIComponent(job.id)}?rollbackToken=${encodeURIComponent(job.rollbackToken)}`,
          { method: 'DELETE', cache: 'no-store' },
        )
        const payload = (await response.json()) as { success?: boolean; error?: string }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to roll back this import.')
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
    <div className={`rounded-xl border border-gold/15 bg-espresso/35 p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => void triggerDownload('template')}
            className="gap-1.5 border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold disabled:opacity-40"
          >
            {downloading === 'template' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Template
          </Button>
        )}

        {capabilities.canExportWorksheet && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading !== null}
            onClick={() => void triggerDownload('export')}
            className="gap-1.5 border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold disabled:opacity-40"
          >
            {downloading === 'export' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5" />
            )}
            Export
          </Button>
        )}

        {capabilities.canImportWorksheet && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => setRouteTool('import')}
              className="gap-1.5 bg-gold text-espresso hover:bg-gold-light"
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleHistory}
              disabled={historyLoading}
              className="gap-1.5 border-gold/20 bg-transparent text-champagne/60 hover:bg-gold/10 hover:text-gold"
            >
              {historyLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <History className="size-3.5" />
              )}
              Recent imports
              {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
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
      </div>

      {capabilities.canImportWorksheet && historyOpen && (
        <div className="mt-3 space-y-2 border-t border-gold/10 pt-3">
          {historyLoading ? (
            <p className="font-sans text-xs text-champagne/45">Loading import history…</p>
          ) : jobs.length === 0 ? (
            <p className="font-sans text-xs text-champagne/45">
              No {moduleLabel.toLowerCase()} imports have been saved for this wedding.
            </p>
          ) : (
            jobs.map((job) => {
              const errors = errorSummary(job)
              const canRollback = job.status === 'executed' && Boolean(job.rollbackToken)
              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-2 rounded-lg border border-gold/10 bg-espresso/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-sans text-xs font-medium text-champagne">
                        {job.fileName}
                      </p>
                      <Badge variant="outline" className={`text-[9px] ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 font-sans text-[10px] text-champagne/40">
                      {dateTime(job.createdAt)} · {job.totalRows} rows · {job.createdCount} created ·{' '}
                      {job.updatedCount} updated · {job.skippedCount} skipped
                    </p>
                    {errors && (
                      <p className="mt-1 flex items-center gap-1 font-sans text-[10px] text-clay-light">
                        <AlertTriangle className="size-3 shrink-0" />
                        {errors}
                      </p>
                    )}
                  </div>

                  {canRollback && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rollbackJobId !== null}
                      onClick={() => void rollbackImport(job)}
                      className="shrink-0 gap-1.5 border-clay/30 bg-transparent text-clay-light hover:bg-clay/10"
                    >
                      {rollbackJobId === job.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Roll back
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {capabilities.canImportWorksheet && (
        <ImportDialog
          moduleKey={moduleKey}
          isOpen={importOpen}
          onClose={() => setRouteTool(null)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  )
}
