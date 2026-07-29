'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ImportDialog } from '@/components/wedding/import-dialog'
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

export function ImportExportBar({
  moduleKey,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {
  const { toast } = useToast()
  const [session, setSession] = useState<PlannerSessionPayload | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
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

  const moduleLabel = VALID_MODULE_LABELS[moduleKey] ?? moduleKey
  const capabilities = useMemo(
    () => worksheetPermissionCapabilities(session?.activeWedding?.permissions),
    [session],
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
  }, [onImportComplete])

  if (!permissionsLoaded || !capabilities.canUseWorksheetTools) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-wrap items-center gap-2 ${className}`}
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
          <Button
            type="button"
            size="sm"
            onClick={openImport}
            className="gap-1.5 bg-gold text-espresso hover:bg-gold-light"
          >
            <Upload className="size-3.5" />
            <span>Import</span>
          </Button>
        )}

        <span
          className="ml-1 hidden items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-champagne/40 md:inline-flex"
          title="Actions are controlled by the selected wedding's permissions"
        >
          <ShieldCheck className="size-3" />
          {roleLabel(session?.activeWedding?.membershipRole)}
        </span>
      </motion.div>

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
