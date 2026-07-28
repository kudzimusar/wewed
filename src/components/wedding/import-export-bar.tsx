'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isAdminLoggedIn } from '@/lib/admin-auth'
import { useToast } from '@/hooks/use-toast'
import { ImportDialog } from '@/components/wedding/import-dialog'

/* ============================================================
   ImportExportBar
   ------------------------------------------------------------
   Compact 3-button bar that drops into a planner tab header:
     • Download Template (.xlsx) — /api/templates/[module]
     • Import                    — opens ImportDialog
     • Export (.xlsx)            — /api/exports/[module]?format=xlsx

   Renders only when an admin is logged in. Hidden for guests.

   Props:
     moduleKey         one of: guests, budget, checklist, seating,
                       vendors, timeline, songs, wedding-party,
                       travel, media
     onImportComplete  optional callback fired after a successful
                       import — usually the parent refetches the
                       tab's data so the new rows appear live.
     className         extra Tailwind classes for the wrapper
   ============================================================ */

interface ImportExportBarProps {
  moduleKey: string
  onImportComplete?: () => void
  className?: string
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

export function ImportExportBar({
  moduleKey,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [downloading, setDownloading] = useState<'template' | 'export' | null>(null)

  useEffect(() => {
    setMounted(true)
    setAdmin(isAdminLoggedIn())
    const onFocus = () => setAdmin(isAdminLoggedIn())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const moduleLabel = VALID_MODULE_LABELS[moduleKey] ?? moduleKey

  // ── Download helper — used by both Template and Export buttons ──
  const triggerDownload = useCallback(
    async (endpoint: 'template' | 'export') => {
      setDownloading(endpoint === 'template' ? 'template' : 'export')
      try {
        const url =
          endpoint === 'template'
            ? `/api/templates?module=${encodeURIComponent(moduleKey)}`
            : `/api/exports?module=${encodeURIComponent(moduleKey)}&format=xlsx`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          let msg = `Failed (${res.status})`
          try {
            const j = (await res.json()) as { error?: string }
            if (j?.error) msg = j.error
          } catch {
            /* ignore parse error */
          }
          throw new Error(msg)
        }
        const blob = await res.blob()
        // Filename from Content-Disposition (fallback to a sane default)
        const cd = res.headers.get('Content-Disposition') ?? ''
        const match = cd.match(/filename="?([^";]+)"?/i)
        const filename =
          match?.[1] ??
          (endpoint === 'template'
            ? `wewed-${moduleKey}-template.xlsx`
            : `wewed-${moduleKey}-export.xlsx`)
        const objUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(objUrl)
        toast({
          title: endpoint === 'template' ? 'Template downloaded' : 'Export ready',
          description:
            endpoint === 'template'
              ? `${moduleLabel} template — fill it in and import.`
              : `${moduleLabel} exported to Excel.`,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Download failed'
        toast({
          title: endpoint === 'template' ? 'Template failed' : 'Export failed',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        setDownloading(null)
      }
    },
    [moduleKey, moduleLabel, toast],
  )

  const handleImportComplete = useCallback(() => {
    onImportComplete?.()
  }, [onImportComplete])

  // Don't render until we know the user is an admin. This keeps
  // the bar (and its buttons) hidden from guests without flashing.
  if (!mounted || !admin) {
    return null
  }

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

        <Button
          type="button"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="gap-1.5 bg-gold text-espresso hover:bg-gold-light"
        >
          <Upload className="size-3.5" />
          <span>Import</span>
        </Button>

        <span
          className="ml-1 hidden items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-champagne/40 md:inline-flex"
          title="These actions are admin-only"
        >
          <Lock className="size-3" />
          Admin
        </span>
      </motion.div>

      <ImportDialog
        moduleKey={moduleKey}
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={handleImportComplete}
      />
    </>
  )
}
