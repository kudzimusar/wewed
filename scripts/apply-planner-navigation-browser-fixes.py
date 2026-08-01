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


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    source = file.read_text()
    if old not in source:
        if new in source:
            return
        raise SystemExit(f'Missing expected marker in {path}: {old}')
    file.write_text(source.replace(old, new))
    print(f'Updated all matching markers in {path}')


update(
    'src/components/wedding/planner-workspace.tsx',
    [(
        '<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">',
        '<div data-planner-module-scroll="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">',
    )],
)

update(
    'src/components/wedding/planner-workspace-stage7.tsx',
    [(
        """    const scrollable = (element: HTMLElement) => {
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
""",
        """    const findPrimary = () =>
      root.querySelector<HTMLElement>('[data-planner-module-scroll="true"]')
""",
    )],
)

update(
    'src/lib/planner-filter-state.ts',
    [(
        """    if (!pathname.startsWith('/planner/')) return
    const next = new URLSearchParams(searchParams.toString())
""",
        """    const livePathname = window.location.pathname
    if (!livePathname.startsWith('/planner/')) return
    const current = new URLSearchParams(window.location.search)
    const next = new URLSearchParams(current)
""",
    ), (
        """    const currentQuery = searchParams.toString()
    const nextQuery = next.toString()
    if (nextQuery === currentQuery) return
    const hash = window.location.hash || '#planner-workspace'
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`, { scroll: false })
""",
        """    const currentQuery = current.toString()
    const nextQuery = next.toString()
    if (nextQuery === currentQuery) return
    const hash = window.location.hash || '#planner-workspace'
    router.replace(`${livePathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`, { scroll: false })
""",
    )],
)

replace_all(
    'tests/e2e/planner-gap-closure.spec.ts',
    'await expect(page).toHaveURL(/[?&]module=tasks/)',
    "await expect(page).toHaveURL(/\\/planner\\/tasks(?:[?#]|$)/)",
)
replace_all(
    'tests/e2e/planner-gap-closure.spec.ts',
    'await expect(page).toHaveURL(/[?&]module=budget/)',
    "await expect(page).toHaveURL(/\\/planner\\/budget(?:[?#]|$)/)",
)
replace_all(
    'tests/e2e/planner-gap-closure.spec.ts',
    'await expect(page).toHaveURL(/[?&]module=guests/)',
    "await expect(page).toHaveURL(/\\/planner\\/guests(?:[?#]|$)/)",
)

update(
    'tests/e2e/planner-deep-link-navigation.spec.ts',
    [(
        """  await openModule(plannerPage, 'checklist')
  const scrollOwner = plannerPage.locator('[data-planner-primary-scroll="true"]')
  await expect(scrollOwner).toBeVisible()
  const maximumScroll = await scrollOwner.evaluate((element) => element.scrollHeight - element.clientHeight)
  expect(maximumScroll).toBeGreaterThan(80)
""",
        """  await plannerPage.setViewportSize({ width: 430, height: 667 })
  await openModule(plannerPage, 'checklist')
  const scrollOwner = plannerPage.locator('[data-planner-primary-scroll="true"]')
  await expect(scrollOwner).toBeVisible()
  await expect.poll(async () =>
    scrollOwner.evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBeGreaterThan(80)
""",
    )],
)

update(
    'tests/e2e/planner-overlay-containment.spec.ts',
    [(
        """  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  })
""",
        """  await dialog.evaluate(async (element) => {
    const animated = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))]
    await Promise.all(
      animated.flatMap((node) => node.getAnimations()).map((animation) => animation.finished.catch(() => undefined)),
    )
  })
""",
    )],
)

update(
    'src/lib/planner-complete-gap-closure.test.ts',
    [(
        """    expect(workspace).toContain('id="planner-workspace-section"')
""",
        """    expect(workspace).toContain('id="planner-workspace-section"')
    expect(workspace).toContain('data-planner-module-scroll="true"')
""",
    ), (
        """    expect(tools).toContain("pathname === '/planner'")
""",
        """    expect(tools).toContain("pathname === '/planner'")
    expect(tools).toContain("pathname.startsWith('/planner/')")
""",
    )],
)
