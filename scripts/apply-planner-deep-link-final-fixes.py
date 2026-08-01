from pathlib import Path


def update(path: str, replacements: list[tuple[str, str]]) -> None:
    file = Path(path)
    source = file.read_text()
    for old, new in replacements:
        if new in source:
            continue
        if old not in source:
            raise SystemExit(f'Missing expected block in {path}:\n{old}')
        source = source.replace(old, new, 1)
    file.write_text(source)
    print(f'Updated {path}')


update(
    'src/components/wedding/planner-workspace-stage7.tsx',
    [
        (
            """    const storageKey = `wewed:planner:scroll:${routeKey}`
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    let current: HTMLElement | null = null
    let restored = false
""",
            """    const storageKey = `wewed:planner:scroll:${routeKey}`
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
    let restored = savedPosition === 0
""",
        ),
        (
            """    const save = () => {
      if (!current) return
      try {
        window.sessionStorage.setItem(storageKey, String(Math.max(0, current.scrollTop)))
      } catch {
        // Scroll restoration remains a progressive enhancement.
      }
    }
""",
            """    const save = () => {
      if (!current) return
      const position = Math.max(0, current.scrollTop)
      if (!restored && savedPosition > 0 && position === 0) return
      savedPosition = position
      try {
        window.sessionStorage.setItem(storageKey, String(position))
      } catch {
        // Scroll restoration remains a progressive enhancement.
      }
    }
""",
        ),
        (
            """      try {
        const saved = Number(window.sessionStorage.getItem(storageKey) ?? 0)
        if (Number.isFinite(saved) && saved > 0) {
          const maximum = current.scrollHeight - current.clientHeight
          if (maximum <= 0) return
          current.scrollTop = Math.min(saved, maximum)
          if (current.scrollTop <= 0) return
        }
      } catch {
        // Ignore unavailable or malformed session storage.
      }
      restored = true
""",
            """      if (savedPosition > 0) {
        const maximum = current.scrollHeight - current.clientHeight
        if (maximum <= 0) return
        current.scrollTop = Math.min(savedPosition, maximum)
        if (current.scrollTop <= 0) return
      }
      restored = true
""",
        ),
        (
            """  const routeKey = plannerLocation(pathname, new URLSearchParams(searchParams.toString()))
  const rootRef = usePlannerScrollPersistence(routeKey, workspaceVersion)
""",
            """  const routeKey = pathname
  const rootRef = usePlannerScrollPersistence(routeKey, workspaceVersion)
""",
        ),
        (
            """  const urlToolsOpen = searchParams.get('panel') === 'worksheet'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)
""",
            """  const urlToolsOpen = searchParams.get('panel') === 'worksheet'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)
  const pendingToolsOpen = useRef<boolean | null>(null)
""",
        ),
        (
            """  useEffect(() => setToolsOpen(urlToolsOpen), [urlToolsOpen])
""",
            """  useEffect(() => {
    if (pendingToolsOpen.current !== null && pendingToolsOpen.current !== urlToolsOpen) return
    pendingToolsOpen.current = null
    setToolsOpen(urlToolsOpen)
  }, [urlToolsOpen])
""",
        ),
        (
            """    const nextOpen = !toolsOpen
    setToolsOpen(nextOpen)
""",
            """    const nextOpen = !toolsOpen
    pendingToolsOpen.current = nextOpen
    setToolsOpen(nextOpen)
""",
        ),
    ],
)

update(
    'src/components/wedding/planner-portal.tsx',
    [
        (
            "import { useEffect, useMemo, useState } from 'react'",
            "import { useEffect, useMemo, useRef, useState } from 'react'",
        ),
        (
            """  const urlToolsOpen = searchParams.get('panel') === 'experience'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)

  useEffect(() => setToolsOpen(urlToolsOpen), [urlToolsOpen])
""",
            """  const urlToolsOpen = searchParams.get('panel') === 'experience'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)
  const pendingToolsOpen = useRef<boolean | null>(null)

  useEffect(() => {
    if (pendingToolsOpen.current !== null && pendingToolsOpen.current !== urlToolsOpen) return
    pendingToolsOpen.current = null
    setToolsOpen(urlToolsOpen)
  }, [urlToolsOpen])
""",
        ),
        (
            """    const nextOpen = !toolsOpen
    setToolsOpen(nextOpen)
""",
            """    const nextOpen = !toolsOpen
    pendingToolsOpen.current = nextOpen
    setToolsOpen(nextOpen)
""",
        ),
    ],
)

update(
    'src/components/ui/dialog.tsx',
    [(
        'absolute right-2 top-[max(1rem,env(safe-area-inset-top))] z-30',
        'absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30',
    )],
)

update(
    'src/components/wedding/import-dialog.tsx',
    [(
        """  'Task',
  'Title',
""",
        """  'Task',
  'Task Title',
  'Title',
""",
    )],
)

update(
    'tests/e2e/planner-data-workflows.spec.ts',
    [(
        """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const importDialog = page.getByRole('dialog')
  await importDialog.locator('input[type="file"]').setInputFiles(importPath)
  await expect(importDialog.getByTestId('import-review-table-scroll').getByRole('cell', { name: importedTask, exact: true })).toBeVisible()
""",
        """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/tasks\/import(?:[?#]|$)/)
  const importDialog = page.getByRole('dialog')
  await expect(importDialog).toBeVisible()
  const previewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  await importDialog.locator('input[type="file"]').setInputFiles(importPath)
  expect((await previewResponse).ok()).toBe(true)
  await expect(importDialog.getByTestId('import-review-table-scroll').getByRole('cell', { name: importedTask, exact: true })).toBeVisible()
""",
    )],
)

update(
    'tests/e2e/planner-deep-link-navigation.spec.ts',
    [(
        """    const key = `wewed:planner:scroll:${window.location.pathname}${window.location.search}`
""",
        """    const key = `wewed:planner:scroll:${window.location.pathname}`
""",
    )],
)

update(
    'src/lib/planner-complete-gap-closure.test.ts',
    [
        (
            """      'wewed:planner:scroll:',
      "window.addEventListener('pagehide', save)",
""",
            """      'wewed:planner:scroll:',
      'let savedPosition = 0',
      'if (!restored && savedPosition > 0 && position === 0) return',
      'const routeKey = pathname',
      'pendingToolsOpen.current = nextOpen',
      "window.addEventListener('pagehide', save)",
""",
        ),
        (
            """    expect(portal).toContain("searchParams.get('panel') === 'experience'")
""",
            """    expect(portal).toContain("searchParams.get('panel') === 'experience'")
    expect(portal).toContain('pendingToolsOpen.current = nextOpen')
""",
        ),
        (
            """    for (const marker of [
      'routeTool?: PlannerToolSlug | null',
""",
            """    expect(worksheetBar).toContain('routeTool?: PlannerToolSlug | null')
    expect(await source('src/components/wedding/import-dialog.tsx')).toContain("'Task Title'")
    for (const marker of [
""",
        ),
    ],
)
