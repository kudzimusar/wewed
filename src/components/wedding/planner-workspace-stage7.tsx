'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react'
import { ImportExportBar } from '@/components/wedding/import-export-bar'
import {
  PlannerWorkspace as CorePlannerWorkspace,
  type WorkspaceTab,
} from '@/components/wedding/planner-workspace'

const WORKSPACE_MODULES: Array<{
  value: WorkspaceTab
  label: string
  worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating'
}> = [
  { value: 'overview', label: 'Overview' },
  { value: 'tasks', label: 'Tasks', worksheetKey: 'checklist' },
  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },
  { value: 'vendors', label: 'Vendors', worksheetKey: 'vendors' },
  { value: 'guests', label: 'Guests', worksheetKey: 'guests' },
  { value: 'timeline', label: 'Timeline', worksheetKey: 'timeline' },
  { value: 'seating', label: 'Seating', worksheetKey: 'seating' },
]

const VALID_MODULES = new Set<WorkspaceTab>(WORKSPACE_MODULES.map((module) => module.value))

function parseModule(value: string | null): WorkspaceTab {
  return value && VALID_MODULES.has(value as WorkspaceTab) ? (value as WorkspaceTab) : 'overview'
}

export function PlannerWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseModule(searchParams.get('module'))
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const [toolsOpen, setToolsOpen] = useState(false)

  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

  const selectWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      const next = new URLSearchParams(searchParams.toString())
      next.set('module', tab)
      router.push(`${pathname}?${next.toString()}#planner-workspace`, { scroll: false })
      setToolsOpen(false)
    },
    [pathname, router, searchParams],
  )

  const handleWorksheetChanged = useCallback(() => {
    setWorkspaceVersion((current) => current + 1)
  }, [])

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-espresso text-champagne"
      data-active-planner-module={activeTab}
    >
      <section className="shrink-0 border-b border-gold/15 bg-espresso/95 px-3 py-2 sm:px-5 sm:py-3">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">
                <FileSpreadsheet className="size-3.5" />
                Worksheet recovery
              </p>
              <p className="mt-1 hidden font-sans text-xs text-champagne/45 sm:block">
                Download templates, preview imports, export saved data, inspect history, or roll back an import.
              </p>
            </div>
            <button
              type="button"
              data-testid="worksheet-tools-toggle"
              aria-expanded={toolsOpen}
              aria-controls="planner-worksheet-tools"
              onClick={() => setToolsOpen((open) => !open)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gold/20 px-3 font-sans text-xs text-gold sm:hidden"
            >
              {activeModule.label}
              {toolsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>

          <div
            id="planner-worksheet-tools"
            className={`${toolsOpen ? 'mt-3 flex' : 'hidden'} flex-col gap-3 sm:mt-3 sm:flex`}
          >
            <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap" aria-label="Worksheet module selector">
              {WORKSPACE_MODULES.map((module) => (
                <button
                  key={module.value}
                  type="button"
                  data-testid={`worksheet-module-${module.worksheetKey ?? 'overview'}`}
                  onClick={() => selectWorkspaceTab(module.value)}
                  aria-pressed={activeTab === module.value}
                  className={`min-h-10 rounded-md border px-2.5 py-1.5 font-sans text-[11px] transition-colors ${
                    activeTab === module.value
                      ? 'border-gold/35 bg-gold/12 text-gold'
                      : 'border-gold/10 text-champagne/55 hover:border-gold/25 hover:text-champagne'
                  }`}
                >
                  {module.label}
                </button>
              ))}
            </div>

            {activeModule.worksheetKey ? (
              <ImportExportBar
                moduleKey={activeModule.worksheetKey}
                onImportComplete={handleWorksheetChanged}
              />
            ) : (
              <p className="rounded-lg border border-gold/10 bg-champagne/[0.025] px-3 py-2 font-sans text-xs text-champagne/45">
                Select a working module to use templates, imports, exports, and recent-import recovery.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1">
        <CorePlannerWorkspace
          key={workspaceVersion}
          activeTab={activeTab}
          onActiveTabChange={selectWorkspaceTab}
        />
      </div>
    </div>
  )
}
