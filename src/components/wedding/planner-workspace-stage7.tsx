'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react'
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

function plannerLocation(pathname: string, search: URLSearchParams): string {
  const query = search.toString()
  return `${pathname}${query ? `?${query}` : ''}`
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
    let targetPosition = 0
    try {
      const stored = Number(window.sessionStorage.getItem(storageKey) ?? 0)
      targetPosition = Number.isFinite(stored) ? Math.max(0, stored) : 0
    } catch {
      targetPosition = 0
    }

    // Data loading and responsive hydration can replace the owned scroll node
    // after the first successful restore. Keep protecting and reapplying the
    // saved position during that settling window, but stop immediately when the
    // user starts interacting so restoration never fights deliberate scrolling.
    let restorationActive = targetPosition > 0
    let userInteracted = false

    const findPrimary = () =>
      root.querySelector<HTMLElement>('[data-planner-module-scroll="true"]')

    const persist = (position: number) => {
      targetPosition = Math.max(0, position)
      try {
        window.sessionStorage.setItem(storageKey, String(targetPosition))
      } catch {
        // Scroll restoration remains a progressive enhancement.
      }
    }

    const save = () => {
      if (!current) return
      const position = Math.max(0, current.scrollTop)
      if (restorationActive && targetPosition > 0 && position === 0) return
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
      if (!restorationActive || userInteracted || targetPosition <= 0) return
      const maximum = current.scrollHeight - current.clientHeight
      if (maximum <= 0) return
      const desired = Math.min(targetPosition, maximum)
      if (desired > 0 && current.scrollTop !== desired) current.scrollTop = desired
    }

    const stopRestorationForUser = () => {
      if (!restorationActive) return
      userInteracted = true
      restorationActive = false
      save()
    }

    const finishRestoration = () => {
      restore()
      restorationActive = false
      save()
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
    root.addEventListener('touchstart', stopRestorationForUser, { passive: true })
    root.addEventListener('pointerdown', stopRestorationForUser, { passive: true })
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
      root.removeEventListener('touchstart', stopRestorationForUser)
      root.removeEventListener('pointerdown', stopRestorationForUser)
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
  const urlToolsOpen = searchParams.get('panel') === 'worksheet'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)
  const pendingToolsOpen = useRef<boolean | null>(null)
  const routeKey = pathname
  const rootRef = usePlannerScrollPersistence(routeKey, workspaceVersion)

  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

  useEffect(() => {
    if (pendingToolsOpen.current !== null && pendingToolsOpen.current !== urlToolsOpen) return
    pendingToolsOpen.current = null
    setToolsOpen(urlToolsOpen)
  }, [urlToolsOpen])

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

  const selectWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
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
    [router, searchParams],
  )

  const selectWorkspaceTool = useCallback(
    (tool: PlannerToolSlug | null) => {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('module')
      const query = next.toString()
      router.push(
        `${plannerModulePath(activeTab, tool)}${query ? `?${query}` : ''}#planner-workspace`,
        { scroll: false },
      )
    },
    [activeTab, router, searchParams],
  )

  const toggleWorksheetTools = useCallback(() => {
    const nextOpen = !toolsOpen
    pendingToolsOpen.current = nextOpen
    setToolsOpen(nextOpen)
    const next = new URLSearchParams(window.location.search)
    if (nextOpen) next.set('panel', 'worksheet')
    else if (next.get('panel') === 'worksheet') next.delete('panel')
    const query = next.toString()
    router.replace(`${plannerModulePath(activeTab, activeTool)}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, router, toolsOpen])

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
              onClick={toggleWorksheetTools}
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
                routeTool={activeTool}
                onRouteToolChange={selectWorkspaceTool}
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
