'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  LayoutGrid,
  Printer,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { ImportExportBar } from '@/components/wedding/import-export-bar'
import {
  PlannerWorkspace as CorePlannerWorkspace,
  type WorkspaceTab,
} from '@/components/wedding/planner-workspace'
import {
  plannerModuleFromPath,
  plannerModulePath,
  plannerToolFromPath,
  type PlannerToolSlug,
} from '@/lib/planner-route-state'
import {
  openPlannerWorksheetCommandCenter,
  refreshPlannerWorksheet,
} from '@/lib/planner-workspace-events'

const WORKSPACE_MODULES: Array<{
  value: WorkspaceTab
  label: string
  worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating' | 'contributions'
}> = [
  { value: 'overview', label: 'Overview' },
  { value: 'tasks', label: 'Tasks', worksheetKey: 'checklist' },
  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },
  { value: 'contributions', label: 'Contributions', worksheetKey: 'contributions' },
  { value: 'vendors', label: 'Vendors', worksheetKey: 'vendors' },
  { value: 'guests', label: 'Guests', worksheetKey: 'guests' },
  { value: 'timeline', label: 'Timeline', worksheetKey: 'timeline' },
  { value: 'seating', label: 'Seating', worksheetKey: 'seating' },
]

const MODULE_PICKER_STORAGE_KEY = 'wewed:planner:worksheet-module-picker-open'
const WORKSHEET_ACTIONS_STORAGE_KEY = 'wewed:planner:worksheet-actions-open'

function readSessionBoolean(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function writeSessionBoolean(key: string, value: boolean): void {
  try {
    window.sessionStorage.setItem(key, String(value))
  } catch {
    // Disclosure persistence remains a progressive enhancement.
  }
}

function usePlannerScrollPersistence(
  routeKey: string,
  workspaceVersion: number,
): React.RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const storageKey = `wewed:planner:scroll:${routeKey}`
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    let current: HTMLElement | null = null
    let savedPosition = 0
    try {
      const stored = Number(window.sessionStorage.getItem(storageKey) ?? 0)
      savedPosition = Number.isFinite(stored) ? Math.max(0, stored) : 0
    } catch {
      savedPosition = 0
    }

    let restored = false
    let restorationActive = savedPosition > 0
    let userInteracted = false

    const findPrimary = () =>
      root.querySelector<HTMLElement>('[data-planner-module-scroll="true"]')

    const persist = (position: number) => {
      savedPosition = Math.max(0, position)
      try {
        window.sessionStorage.setItem(storageKey, String(savedPosition))
      } catch {
        // Scroll restoration remains a progressive enhancement.
      }
    }

    const save = () => {
      if (!current) return
      const position = Math.max(0, current.scrollTop)
      if (!restored && savedPosition > 0 && position === 0) return
      persist(position)
    }

    const restore = () => {
      const next = findPrimary()
      if (!next) return
      if (current !== next) {
        current?.removeEventListener('scroll', save)
        current?.removeAttribute('data-planner-primary-scroll')
        current = next
        current.setAttribute('data-planner-primary-scroll', 'true')
        current.addEventListener('scroll', save, { passive: true })
      }
      if (!restorationActive || userInteracted || savedPosition <= 0) return
      const maximum = current.scrollHeight - current.clientHeight
      if (maximum <= 0) return
      const desired = Math.min(savedPosition, maximum)
      if (desired > 0 && current.scrollTop !== desired) current.scrollTop = desired
    }

    const stopRestorationForUser = () => {
      if (!restorationActive) return
      const position = Math.max(0, current?.scrollTop ?? 0)
      userInteracted = true
      restorationActive = false
      restored = true
      if (position > 0 || savedPosition === 0) persist(position)
    }

    const stopRestorationForKeyboard = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        stopRestorationForUser()
      }
    }

    const finishRestoration = () => {
      restore()
      const position = Math.max(0, current?.scrollTop ?? 0)
      restorationActive = false
      restored = true
      if (position > 0 || savedPosition === 0) persist(position)
    }

    const frame = window.requestAnimationFrame(() => {
      restore()
      window.requestAnimationFrame(restore)
    })
    const retry = window.setInterval(restore, 200)
    const stopRetry = window.setTimeout(() => {
      window.clearInterval(retry)
      finishRestoration()
    }, 8_000)
    const observer = new MutationObserver(restore)
    observer.observe(root, { childList: true, subtree: true })
    const resizeObserver = new ResizeObserver(restore)
    resizeObserver.observe(root)
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    root.addEventListener('wheel', stopRestorationForUser, { passive: true })
    root.addEventListener('touchmove', stopRestorationForUser, { passive: true })
    window.addEventListener('keydown', stopRestorationForKeyboard)
    window.addEventListener('beforeunload', save)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', saveWhenHidden)

    return () => {
      save()
      window.cancelAnimationFrame(frame)
      window.clearInterval(retry)
      window.clearTimeout(stopRetry)
      observer.disconnect()
      resizeObserver.disconnect()
      root.removeEventListener('wheel', stopRestorationForUser)
      root.removeEventListener('touchmove', stopRestorationForUser)
      window.removeEventListener('keydown', stopRestorationForKeyboard)
      window.removeEventListener('beforeunload', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', saveWhenHidden)
      current?.removeEventListener('scroll', save)
      current?.removeAttribute('data-planner-primary-scroll')
      window.history.scrollRestoration = previousRestoration
    }
  }, [routeKey, workspaceVersion])

  return rootRef
}

export function PlannerWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const legacyModule = searchParams.get('module')
  const activeTab = plannerModuleFromPath(pathname, legacyModule) as WorkspaceTab
  const activeTool = plannerToolFromPath(pathname, activeTab)
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const urlActionsOpen = searchParams.get('panel') === 'worksheet'
  const initialUrlActionsOpen = useRef(urlActionsOpen)
  const [modulePickerOpen, setModulePickerOpen] = useState(false)
  const [worksheetActionsOpen, setWorksheetActionsOpen] = useState(urlActionsOpen)
  const pendingActionsOpen = useRef<boolean | null>(null)
  const routeKey = pathname
  const rootRef = usePlannerScrollPersistence(routeKey, workspaceVersion)

  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

  useEffect(() => {
    setModulePickerOpen(readSessionBoolean(MODULE_PICKER_STORAGE_KEY))
    if (!initialUrlActionsOpen.current) {
      setWorksheetActionsOpen(readSessionBoolean(WORKSHEET_ACTIONS_STORAGE_KEY))
    }
  }, [])

  useEffect(() => {
    if (pendingActionsOpen.current !== null && pendingActionsOpen.current !== urlActionsOpen) return
    if (pendingActionsOpen.current !== null) {
      pendingActionsOpen.current = null
      setWorksheetActionsOpen(urlActionsOpen)
      return
    }
    if (urlActionsOpen) setWorksheetActionsOpen(true)
  }, [urlActionsOpen])

  useEffect(() => {
    const canonicalPath = plannerModulePath(activeTab, activeTool)
    if (pathname === canonicalPath && !legacyModule) return
    const next = new URLSearchParams(searchParams.toString())
    next.delete('module')
    const query = next.toString()
    router.replace(`${canonicalPath}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, legacyModule, pathname, router, searchParams])

  const collapseControls = useCallback(() => {
    setModulePickerOpen(false)
    setWorksheetActionsOpen(false)
    writeSessionBoolean(MODULE_PICKER_STORAGE_KEY, false)
    writeSessionBoolean(WORKSHEET_ACTIONS_STORAGE_KEY, false)
  }, [])

  const selectWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      collapseControls()
      const next = new URLSearchParams(searchParams.toString())
      next.delete('module')
      next.delete('panel')
      for (const key of Array.from(next.keys())) {
        if (key.startsWith('filter_')) next.delete(key)
      }
      const query = next.toString()
      router.push(`${plannerModulePath(tab)}${query ? `?${query}` : ''}#planner-workspace`, {
        scroll: false,
      })
    },
    [collapseControls, router, searchParams],
  )

  const selectWorkspaceTool = useCallback(
    (tool: PlannerToolSlug | null) => {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('module')
      if (tool === null) {
        setModulePickerOpen(false)
        writeSessionBoolean(MODULE_PICKER_STORAGE_KEY, false)
        next.delete('panel')
      }
      const query = next.toString()
      router.push(
        `${plannerModulePath(activeTab, tool)}${query ? `?${query}` : ''}#planner-workspace`,
        { scroll: false },
      )
    },
    [activeTab, router, searchParams],
  )

  const toggleWorksheetActions = useCallback(() => {
    const nextOpen = !worksheetActionsOpen
    pendingActionsOpen.current = nextOpen
    setWorksheetActionsOpen(nextOpen)
    if (!nextOpen) setModulePickerOpen(false)
    writeSessionBoolean(WORKSHEET_ACTIONS_STORAGE_KEY, nextOpen)
    if (!nextOpen) writeSessionBoolean(MODULE_PICKER_STORAGE_KEY, false)

    const next = new URLSearchParams(window.location.search)
    if (nextOpen) next.set('panel', 'worksheet')
    else if (next.get('panel') === 'worksheet') next.delete('panel')
    const query = next.toString()
    router.replace(`${plannerModulePath(activeTab, activeTool)}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, router, worksheetActionsOpen])

  const toggleModulePicker = useCallback(() => {
    const nextOpen = !modulePickerOpen
    setModulePickerOpen(nextOpen)
    writeSessionBoolean(MODULE_PICKER_STORAGE_KEY, nextOpen)
  }, [modulePickerOpen])

  const handleWorksheetChanged = useCallback(() => {
    setWorkspaceVersion((current) => current + 1)
  }, [])

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col bg-espresso text-champagne"
      data-active-planner-module={activeTab}
      data-planner-route={plannerModulePath(activeTab, activeTool)}
    >
      <section
        data-worksheet-actions-shell
        className="shrink-0 border-b border-gold/15 bg-espresso/95 px-3 py-1.5 sm:px-5"
      >
        <div id="planner-worksheet-tools" className="mx-auto w-full max-w-7xl">
          <div className="flex min-h-10 items-center gap-2">
            <div className="mr-auto min-w-0">
              <p className="flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">
                <FileSpreadsheet className="size-3.5" />
                {activeModule.label}
              </p>
              <p className="hidden truncate font-sans text-[11px] text-champagne/45 sm:block">
                Worksheet · open actions only when you need them
              </p>
            </div>

            <button
              type="button"
              data-testid="worksheet-actions-toggle"
              aria-expanded={worksheetActionsOpen}
              aria-controls="planner-worksheet-actions"
              onClick={toggleWorksheetActions}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gold/25 bg-gold/5 px-3 font-sans text-xs font-medium text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <SlidersHorizontal className="size-4" />
              Actions
              {worksheetActionsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>

          <div
            id="planner-worksheet-actions"
            className={worksheetActionsOpen ? 'mt-2 block border-t border-gold/10 pt-2' : 'hidden'}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                data-testid="planner-worksheet-command-trigger"
                onClick={openPlannerWorksheetCommandCenter}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 text-left text-sm font-medium text-gold hover:bg-gold/12"
              >
                <Printer className="size-4 shrink-0" />
                <span>
                  <span className="block">
                    {activeTab === 'overview' ? 'Print / Save PDF' : 'Print / Arrange / Select'}
                  </span>
                  <span className="block text-[10px] font-normal text-champagne/45">
                    {activeTab === 'overview' ? 'A4 overview working document' : 'A4 output and record actions'}
                  </span>
                </span>
              </button>

              <button
                type="button"
                data-testid="worksheet-refresh-action"
                onClick={refreshPlannerWorksheet}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-gold/15 px-3 text-left text-sm text-champagne/70 hover:border-gold/30 hover:text-gold"
              >
                <RefreshCw className="size-4 shrink-0" />
                <span>
                  <span className="block">Refresh data</span>
                  <span className="block text-[10px] text-champagne/40">Reload the selected wedding worksheets</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="worksheet-tools-toggle"
                aria-expanded={modulePickerOpen}
                aria-controls="planner-worksheet-modules"
                onClick={toggleModulePicker}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-gold/15 px-3 text-left text-sm text-champagne/70 hover:border-gold/30 hover:text-gold"
              >
                <LayoutGrid className="size-4 shrink-0" />
                <span>
                  <span className="block">Switch worksheet</span>
                  <span className="block text-[10px] text-champagne/40">Overview, Tasks, Budget and more</span>
                </span>
              </button>
            </div>

            <div
              id="planner-worksheet-modules"
              className={`${modulePickerOpen ? 'mt-2 grid' : 'hidden'} grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8`}
              aria-label="Worksheet module selector"
            >
              {WORKSPACE_MODULES.map((module) => (
                <button
                  key={module.value}
                  data-testid={`worksheet-module-${module.worksheetKey ?? 'overview'}`}
                  type="button"
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

            <div className="mt-2" data-worksheet-data-recovery>
              {activeModule.worksheetKey ? (
                <ImportExportBar
                  moduleKey={activeModule.worksheetKey}
                  routeTool={activeTool}
                  onRouteToolChange={selectWorkspaceTool}
                  onImportComplete={handleWorksheetChanged}
                  className={activeTool === 'imports'
                    ? 'max-h-[42dvh] overflow-y-auto overscroll-contain [scrollbar-gutter:stable] sm:max-h-96'
                    : ''}
                />
              ) : (
                <p className="rounded-lg border border-gold/10 bg-champagne/[0.025] px-3 py-2 font-sans text-xs text-champagne/45">
                  Select a working module to use templates, imports, exports, and recent-import recovery.
                </p>
              )}
            </div>
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
