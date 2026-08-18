import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

const source = (path: string) => readFileSync(path, 'utf8')

const plan = source('docs/ADAPTIVE_WORKSPACE_NAVIGATION_SETTINGS_PLAN.md')
const rootLayout = source('src/app/layout.tsx')
const plannerLayout = source('src/app/planner/layout.tsx')
const adaptiveCss = source('src/app/planner/adaptive-navigation.css')
const portal = source('src/components/wedding/planner-portal.tsx')
const adaptiveMenu = source('src/components/navigation/planner-adaptive-navigation.tsx')
const quickNavigation = source('src/components/navigation/workspace-quick-navigation.tsx')
const commandCenter = source('src/components/wedding/planner/planner-worksheet-command-center.tsx')
const stage7 = source('src/components/wedding/planner-workspace-stage7.tsx')
const settings = source('src/app/settings/page.tsx')
const events = source('src/lib/planner-workspace-events.ts')

describe('WW-ADAPTIVE-NAV-2026-08-18-01 release contract', () => {
  test('keeps the stamped plan authoritative and records the current UAT defect separately', () => {
    expect(plan).toContain('WW-ADAPTIVE-NAV-2026-08-18-01')
    expect(plan).toContain('STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN')
    expect(plan).toContain('Task Test 11 — Priority filter: **FAIL**')
    expect(plan).toContain('filter-function defect; no task mutation or data-integrity failure observed')
  })

  test('replaces competing Planner floating navigation with one embedded adaptive menu', () => {
    expect(plannerLayout).not.toContain('PlannerAccountDock')
    expect(plannerLayout).toContain('PlannerRouteDialogEscapeGuard')
    expect(portal).toContain('<PlannerAdaptiveNavigation')
    expect(adaptiveMenu).toContain('aria-label="Open Wewed menu"')
    expect(adaptiveMenu).toContain('Workspace')
    expect(adaptiveMenu).toContain('Brief')
    expect(adaptiveMenu).toContain('Messages')
    expect(adaptiveMenu).toContain('Settings')
    expect(adaptiveMenu).toContain('Switch account')
    expect(adaptiveMenu).toContain('Sign out')
    expect(quickNavigation).toContain('plannerUsesEmbeddedAdaptiveNavigation')
    expect(quickNavigation).toContain("pathname === '/planner'")
  })

  test('keeps worksheet power behind one progressive Actions disclosure including Overview printing', () => {
    expect(stage7).toContain('data-testid="worksheet-actions-toggle"')
    expect(stage7).toContain('Actions')
    expect(stage7).toContain('data-testid="planner-worksheet-command-trigger"')
    expect(stage7).toContain("activeTab === 'overview' ? 'Print / Save PDF' : 'Print / Arrange / Select'")
    expect(stage7).toContain('A4 overview working document')
    expect(stage7).toContain('data-testid="worksheet-tools-toggle"')
    expect(stage7).toContain('Switch worksheet')
    expect(stage7).toContain('<ImportExportBar')
    expect(stage7).toContain('data-worksheet-data-recovery')
    expect(stage7).not.toContain('Worksheet recovery')
  })

  test('retires the fixed worksheet launcher instead of merely hiding it', () => {
    expect(rootLayout).not.toContain('PlannerWorksheetCommandCenter')
    expect(plannerLayout).toContain('PlannerWorksheetCommandCenter')
    expect(commandCenter).toContain('PLANNER_COMMAND_CENTER_OPEN_EVENT')
    expect(commandCenter).toContain('window.addEventListener(PLANNER_COMMAND_CENTER_OPEN_EVENT')
    expect(commandCenter).not.toContain('Print · Arrange · Select')
    expect(commandCenter).not.toContain('bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]')
    expect(adaptiveCss).not.toContain("[data-testid='planner-worksheet-command-trigger'].fixed")
    expect(events).toContain('window.dispatchEvent(new CustomEvent(PLANNER_COMMAND_CENTER_OPEN_EVENT))')
    expect(events).not.toContain('document.querySelector')
    expect(events).not.toContain('existingTrigger.click()')
  })

  test('limits the command centre host to Planner workspace routes rather than portfolio or unrelated Planner pages', () => {
    expect(commandCenter).toContain("pathname === '/planner'")
    expect(commandCenter).toContain('overview|tasks|budget|vendors|guests|timeline|seating')
    expect(commandCenter).not.toContain("pathname.startsWith('/planner/')")
  })

  test('provides a real settings home without inventing unsupported persistence', () => {
    expect(settings).toContain('Profile & account')
    expect(settings).toContain('Appearance & accessibility')
    expect(settings).toContain('<ThemeToggle />')
    expect(settings).toContain('Planner preferences')
    expect(settings).toContain('Project & team')
    expect(settings).toContain('Notifications & communication')
    expect(settings).toContain('Privacy & security')
    expect(settings).toContain('no unsupported notification preference is stored')
  })

  test('keeps platform administration separate from project membership', () => {
    expect(settings).toContain('platform-wide Wewed administrator authority')
    expect(plan).toContain('platform-administrator authority remains separate')
  })
})
