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
    let restored = false

    const scrollable = (element: HTMLElement) => {
      const style = window.getComputedStyle(element)
      return (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        element.clientHeight > 0 &&
        element.scrollHeight > element.clientHeight + 8
      )
    }

    const findPrimary = () => {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(scrollable)
      return (
        candidates.sort(
          (left, right) =>
            right.clientHeight * right.clientWidth - left.clientHeight * left.clientWidth,
        )[0] ?? null
      )
    }

    const save = () => {
      if (!current) return
      try {
        window.sessionStorage.setItem(storageKey, String(Math.max(0, current.scrollTop)))
      } catch {
        // Scroll restoration remains a progressive enhancement.
      }
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
      if (restored) return
      try {
        const saved = Number(window.sessionStorage.getItem(storageKey) ?? 0)
        if (Number.isFinite(saved) && saved > 0) current.scrollTop = saved
      } catch {
        // Ignore unavailable or malformed session storage.
      }
      restored = true
    }

    const frame = window.requestAnimationFrame(() => {
      restore()
      window.requestAnimationFrame(restore)
    })
    const retry = window.setInterval(restore, 250)
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 4_000)
    const observer = new MutationObserver(restore)
    observer.observe(root, { childList: true, subtree: true })
    const resizeObserver = new ResizeObserver(restore)
    resizeObserver.observe(root)
    window.addEventListener('beforeunload', save)

    return () => {
      save()
      window.cancelAnimationFrame(frame)
      window.clearInterval(retry)
      window.clearTimeout(stopRetry)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('beforeunload', save)
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
  const toolsOpen = searchParams.get('panel') === 'worksheet'
  const routeKey = plannerLocation(pathname, new URLSearchParams(searchParams.toString()))
  const rootRef = usePlannerScrollPersistence(routeKey, workspaceVersion)

  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

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
    const next = new URLSearchParams(searchParams.toString())
    if (toolsOpen) next.delete('panel')
    else next.set('panel', 'worksheet')
    const query = next.toString()
    router.replace(`${plannerModulePath(activeTab, activeTool)}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, router, searchParams, toolsOpen])

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
