import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const navigation = readFileSync('src/components/navigation/workspace-quick-navigation.tsx', 'utf8')
const portfolio = readFileSync('src/app/planner/portfolio/page.tsx', 'utf8')
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8')
const manual = readFileSync('docs/WEWED_PRODUCT_UI_UX_AND_COMMUNICATIONS_MANUAL.md', 'utf8')

describe('compact authenticated workspace navigation', () => {
  test('mounts before page content so shared reservation can protect legacy private headers', () => {
    expect(rootLayout).toContain("import { WorkspaceQuickNavigation } from '@/components/navigation/workspace-quick-navigation'")
    expect(rootLayout).toContain('<WorkspaceQuickNavigation />')
    expect(rootLayout.indexOf('<WorkspaceQuickNavigation />')).toBeLessThan(rootLayout.indexOf('{children}'))
    expect(navigation).toContain('data-testid="workspace-quick-navigation-spacer"')
    expect(navigation).toContain('shouldReserveWorkspaceChrome(pathname)')
    expect(navigation).toContain("!pathname.startsWith('/messages/') && !pathname.startsWith('/notifications')")
  })

  test('provides compact back, forward, switch-account and sign-out actions', () => {
    expect(navigation).toContain('window.history.back()')
    expect(navigation).toContain('window.history.forward()')
    expect(navigation).toContain('Switch account')
    expect(navigation).toContain('Sign out')
    expect(navigation).toContain("fetch('/api/auth/sign-out'")
    expect(navigation).toContain("endSession('/sign-in')")
    expect(navigation).toContain("endSession('/')")
  })

  test('covers authenticated role workspaces without becoming guest/public chrome', () => {
    for (const prefix of ["'/admin'", "'/couple'", "'/planner'", "'/vendor'", "'/messages'", "'/billing'"]) {
      expect(navigation).toContain(prefix)
    }
    expect(navigation).toContain("pathname === '/vendors/manage'")
    expect(navigation).toContain('isPrivateWorkspace(pathname)')
    expect(navigation).toContain('plannerUsesEmbeddedAdaptiveNavigation(pathname)')
    expect(navigation).not.toContain("'/wedding/'")
    expect(navigation).not.toContain("'/guest'")
  })

  test('keeps Planner portfolio inside the embedded adaptive navigation contract', () => {
    expect(navigation).toContain('timeline|seating|portfolio')
    expect(portfolio).toContain("import { PlannerAdaptiveNavigation } from '@/components/navigation/planner-adaptive-navigation'")
    expect(portfolio).toContain('<PlannerAdaptiveNavigation role="planner" showPortfolioLink={false} />')
    expect(portfolio).toContain('data-planner-portfolio-shell')
  })

  test('keeps focus and already-shelled surfaces free of competing fixed navigation', () => {
    expect(navigation).toContain('function usesOwnFocusNavigation(pathname: string): boolean')
    expect(navigation).toContain("pathname === '/messages'")
    expect(navigation).toContain("pathname === '/vendors/manage'")
    expect(navigation).toContain("pathname.startsWith('/vendors/manage/')")
    expect(navigation).toContain('if (usesOwnFocusNavigation(pathname)) return null')
  })

  test('keeps the menu usable on short viewports and closes it across private-route navigation', () => {
    expect(navigation).toContain('useRef<HTMLDetailsElement>(null)')
    expect(navigation).toContain("menuRef.current?.removeAttribute('open')")
    expect(navigation).toContain('}, [pathname])')
    expect(navigation).toContain('onClick={closeMenu}')
    expect(navigation).toContain('max-h-[calc(100dvh-4.5rem-env(safe-area-inset-top))]')
    expect(navigation).toContain('overflow-y-auto overscroll-contain')
  })

  test('uses the stamped compact top-shell contract outside embedded and focus surfaces', () => {
    expect(manual).toContain('WW-PRODUCT-UI-2026-08-23-01')
    expect(manual).toContain('no permanent bottom floating Back/Forward/Bell/Account pill')
    expect(navigation).toContain('size-10')
    expect(navigation).toContain('aria-label="Go back"')
    expect(navigation).toContain('aria-label="Go forward"')
    expect(navigation).toContain('aria-label="Open Wewed menu"')
    expect(navigation).toContain('top-[max(0.75rem,env(safe-area-inset-top))]')
    expect(navigation).not.toContain('bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]')
  })
})
