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
            """      try {
        const saved = Number(window.sessionStorage.getItem(storageKey) ?? 0)
        if (Number.isFinite(saved) && saved > 0) current.scrollTop = saved
      } catch {
        // Ignore unavailable or malformed session storage.
      }
      restored = true
""",
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
        ),
        (
            """    const resizeObserver = new ResizeObserver(restore)
    resizeObserver.observe(root)
    window.addEventListener('beforeunload', save)

    return () => {
""",
            """    const resizeObserver = new ResizeObserver(restore)
    resizeObserver.observe(root)
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('beforeunload', save)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', saveWhenHidden)

    return () => {
""",
        ),
        (
            """      window.removeEventListener('beforeunload', save)
      current?.removeEventListener('scroll', save)
""",
            """      window.removeEventListener('beforeunload', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', saveWhenHidden)
      current?.removeEventListener('scroll', save)
""",
        ),
        (
            """  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const toolsOpen = searchParams.get('panel') === 'worksheet'
  const routeKey = plannerLocation(pathname, new URLSearchParams(searchParams.toString()))
""",
            """  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const urlToolsOpen = searchParams.get('panel') === 'worksheet'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)
  const routeKey = plannerLocation(pathname, new URLSearchParams(searchParams.toString()))
""",
        ),
        (
            """  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

  useEffect(() => {
""",
            """  const activeModule = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.value === activeTab) ?? WORKSPACE_MODULES[0],
    [activeTab],
  )

  useEffect(() => setToolsOpen(urlToolsOpen), [urlToolsOpen])

  useEffect(() => {
""",
        ),
        (
            """  const toggleWorksheetTools = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    if (toolsOpen) next.delete('panel')
    else next.set('panel', 'worksheet')
    const query = next.toString()
    router.replace(`${plannerModulePath(activeTab, activeTool)}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, router, searchParams, toolsOpen])
""",
            """  const toggleWorksheetTools = useCallback(() => {
    const nextOpen = !toolsOpen
    setToolsOpen(nextOpen)
    const next = new URLSearchParams(window.location.search)
    if (nextOpen) next.set('panel', 'worksheet')
    else if (next.get('panel') === 'worksheet') next.delete('panel')
    const query = next.toString()
    router.replace(`${plannerModulePath(activeTab, activeTool)}${query ? `?${query}` : ''}#planner-workspace`, {
      scroll: false,
    })
  }, [activeTab, activeTool, router, toolsOpen])
""",
        ),
    ],
)

update(
    'src/components/wedding/planner-portal.tsx',
    [
        (
            "import Link from 'next/link'\n",
            "import Link from 'next/link'\nimport { useRouter, useSearchParams } from 'next/navigation'\n",
        ),
        (
            """function PlannerExperienceNavigation() {
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
""",
            """function PlannerExperienceNavigation() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlToolsOpen = searchParams.get('panel') === 'experience'
  const [toolsOpen, setToolsOpen] = useState(urlToolsOpen)

  useEffect(() => setToolsOpen(urlToolsOpen), [urlToolsOpen])

  function toggleTools() {
    const nextOpen = !toolsOpen
    setToolsOpen(nextOpen)
    const next = new URLSearchParams(window.location.search)
    if (nextOpen) next.set('panel', 'experience')
    else if (next.get('panel') === 'experience') next.delete('panel')
    const query = next.toString()
    const hash = window.location.hash || '#planner-workspace'
    router.replace(`${window.location.pathname}${query ? `?${query}` : ''}${hash}`, { scroll: false })
  }

  return (
""",
        ),
        (
            "onClick={() => setToolsOpen((open) => !open)}",
            "onClick={toggleTools}",
        ),
    ],
)

update(
    'src/components/ui/dialog.tsx',
    [(
        'absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-30',
        'absolute right-2 top-[max(1rem,env(safe-area-inset-top))] z-30',
    )],
)

update(
    'tests/e2e/planner-data-workflows.spec.ts',
    [
        (
            """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.locator('input[type="file"]').setInputFiles(templatePath)
""",
            """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/guests\/import(?:[?#]|$)/)
  let dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const blankPreviewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  await dialog.locator('input[type="file"]').setInputFiles(templatePath)
  expect((await blankPreviewResponse).ok()).toBe(true)
""",
        ),
        (
            """  await dialog.getByRole('button', { name: 'Close preview' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
""",
            """  await dialog.getByRole('button', { name: 'Close preview' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/planner\/guests(?:[?#]|$)/)
""",
        ),
        (
            """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.locator('input[type="file"]').setInputFiles(formulaPath)
""",
            """  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/guests\/import(?:[?#]|$)/)
  dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const formulaPreviewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  await dialog.locator('input[type="file"]').setInputFiles(formulaPath)
  expect((await formulaPreviewResponse).ok()).toBe(true)
""",
        ),
    ],
)

update(
    'tests/e2e/planner-deep-link-navigation.spec.ts',
    [(
        """  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(320, element.scrollHeight - element.clientHeight)
  })
  const savedPosition = await scrollOwner.evaluate((element) => element.scrollTop)
  expect(savedPosition).toBeGreaterThan(0)

  await plannerPage.reload()
""",
        """  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(320, element.scrollHeight - element.clientHeight)
    element.dispatchEvent(new Event('scroll'))
  })
  const savedPosition = await scrollOwner.evaluate((element) => element.scrollTop)
  expect(savedPosition).toBeGreaterThan(0)
  await expect.poll(async () => plannerPage.evaluate(() => {
    const key = `wewed:planner:scroll:${window.location.pathname}${window.location.search}`
    return Number(window.sessionStorage.getItem(key) ?? 0)
  })).toBeGreaterThan(0)

  await plannerPage.reload()
""",
    )],
)

update(
    'tests/e2e/planner-overlay-containment.spec.ts',
    [
        (
            """    if (expanded !== 'true') await toggle.click()
  }
  await expect(page.locator('#planner-worksheet-tools')).toBeVisible()
""",
            """    if (expanded !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page).toHaveURL(/panel=worksheet/)
  }
  await expect(page.locator('#planner-worksheet-tools')).toBeVisible()
""",
        ),
        (
            """  const closeButtons = dialog.getByRole('button', { name: /^close/i })
  const closeCount = await closeButtons.count()
""",
            """  const sharedCloseButtons = dialog.locator('[data-slot="dialog-close"]')
  const closeButtons = (await sharedCloseButtons.count()) > 0
    ? sharedCloseButtons
    : dialog.getByRole('button', { name: /^close/i }).first()
  const closeCount = await closeButtons.count()
""",
        ),
        (
            """    if (expanded !== 'true') await disclosure.click()
  }
  await expect(page.locator('#planner-experience-tools')).toBeVisible()
""",
            """    if (expanded !== 'true') await disclosure.click()
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect(page).toHaveURL(/panel=experience/)
  }
  await expect(page.locator('#planner-experience-tools')).toBeVisible()
""",
        ),
    ],
)

update(
    'src/lib/planner-complete-gap-closure.test.ts',
    [
        (
            """      'window.sessionStorage.setItem',
    ]) expect(filterState).toContain(marker)
""",
            """      'window.sessionStorage.setItem',
      "window.addEventListener('popstate', hydrateFromLocation)",
    ]) expect(filterState).toContain(marker)
""",
        ),
        (
            """    expect(portal).toContain('data-planner-tools-disclosure')
    expect(portal).toContain('max-h-[42dvh]')
""",
            """    expect(portal).toContain('data-planner-tools-disclosure')
    expect(portal).toContain("searchParams.get('panel') === 'experience'")
    expect(portal).toContain("next.set('panel', 'experience')")
    expect(portal).toContain('max-h-[42dvh]')
""",
        ),
        (
            """      'wewed:planner:scroll:',
      'data-planner-primary-scroll',
""",
            """      'wewed:planner:scroll:',
      "window.addEventListener('pagehide', save)",
      "document.addEventListener('visibilitychange', saveWhenHidden)",
      'data-planner-primary-scroll',
""",
        ),
    ],
)
