'use client'

import { useCallback, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { ImportExportBar } from '@/components/wedding/import-export-bar'
import { PlannerWorkspace as CorePlannerWorkspace } from '@/components/wedding/planner-workspace'

const WORKSHEET_MODULES = [
  { key: 'checklist', label: 'Tasks' },
  { key: 'budget', label: 'Budget' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'guests', label: 'Guests' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'seating', label: 'Seating' },
] as const

type WorksheetModuleKey = (typeof WORKSHEET_MODULES)[number]['key']

/**
 * Stage 7 shell around the mature planner workspace.
 *
 * Worksheet tools stay permission-aware and wedding-scoped inside ImportExportBar.
 * Completing or rolling back an import remounts the core workspace so the selected
 * wedding's saved records are reloaded immediately without a page refresh.
 */
export function PlannerWorkspace() {
  const [worksheetModule, setWorksheetModule] = useState<WorksheetModuleKey>('checklist')
  const [workspaceVersion, setWorkspaceVersion] = useState(0)

  const handleWorksheetChanged = useCallback(() => {
    setWorkspaceVersion((current) => current + 1)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-espresso text-champagne">
      <section className="shrink-0 border-b border-gold/15 bg-espresso/95 px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">
                <FileSpreadsheet className="size-3.5" />
                Worksheet recovery
              </p>
              <p className="mt-1 font-sans text-xs text-champagne/45">
                Download templates, preview imports, export saved data, inspect history, or roll back an import.
              </p>
            </div>
            <div className="flex flex-wrap gap-1" aria-label="Worksheet module selector">
              {WORKSHEET_MODULES.map((module) => (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => setWorksheetModule(module.key)}
                  aria-pressed={worksheetModule === module.key}
                  className={`rounded-md border px-2.5 py-1.5 font-sans text-[10px] transition-colors ${
                    worksheetModule === module.key
                      ? 'border-gold/35 bg-gold/12 text-gold'
                      : 'border-gold/10 text-champagne/50 hover:border-gold/25 hover:text-champagne'
                  }`}
                >
                  {module.label}
                </button>
              ))}
            </div>
          </div>

          {worksheetModule === 'checklist' && (
            <ImportExportBar moduleKey="checklist" onImportComplete={handleWorksheetChanged} />
          )}
          {worksheetModule === 'budget' && (
            <ImportExportBar moduleKey="budget" onImportComplete={handleWorksheetChanged} />
          )}
          {worksheetModule === 'vendors' && (
            <ImportExportBar moduleKey="vendors" onImportComplete={handleWorksheetChanged} />
          )}
          {worksheetModule === 'guests' && (
            <ImportExportBar moduleKey="guests" onImportComplete={handleWorksheetChanged} />
          )}
          {worksheetModule === 'timeline' && (
            <ImportExportBar moduleKey="timeline" onImportComplete={handleWorksheetChanged} />
          )}
          {worksheetModule === 'seating' && (
            <ImportExportBar moduleKey="seating" onImportComplete={handleWorksheetChanged} />
          )}
        </div>
      </section>

      <div className="min-h-0 flex-1">
        <CorePlannerWorkspace key={workspaceVersion} />
      </div>
    </div>
  )
}
