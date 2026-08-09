'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeDollarSign,
  Command,
  Download,
  Keyboard,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Capabilities = {
  role: string
  isSuperAdmin: boolean
  canSyncWorkItems: boolean
  canReadBilling: boolean
  canManageBilling: boolean
  canExportAccounts: boolean
  canExportQueue: boolean
  canExportPeople: boolean
  canExportCommercial: boolean
}

type CommandResult = {
  id: string
  kind: string
  title: string
  subtitle: string
  panel?: string
  href?: string
  search?: string
}

type Offer = {
  offerCode: string
  offerFamilyCode: string
  supersedesOfferCode: string | null
  accountType: string
  name: string
  description: string
  billingModel: string
  legacyPlan: string
  currency: string
  monthlyCents: number | null
  annualCents: number | null
  departmentKeys: unknown
  entitlements: unknown
  selfService: boolean
  status: string
  version: number
  assignmentCount: number
}

type OfferForm = {
  accountType: string
  offerCode: string
  name: string
  description: string
  billingModel: string
  legacyPlan: string
  currency: string
  monthlyCents: string
  annualCents: string
  departmentKeys: string
  entitlements: string
  selfService: boolean
  reason: string
}

const EMPTY_OFFER: OfferForm = {
  accountType: 'vendor',
  offerCode: '',
  name: '',
  description: '',
  billingModel: 'subscription',
  legacyPlan: 'professional',
  currency: 'USD',
  monthlyCents: '',
  annualCents: '',
  departmentKeys: '',
  entitlements: '',
  selfService: false,
  reason: '',
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return (
    element.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
  )
}

function commandCentreRoot() {
  return document.querySelector<HTMLElement>('[data-admin-command-centre="true"]')
}

function clickCommandPanel(panel: string) {
  const root = commandCentreRoot()
  if (!root) return false
  const labels: Record<string, string> = {
    overview: 'Home',
    accounts: 'Accounts',
    people: 'People',
    commercial: 'Commercial',
  }
  const label = labels[panel]
  if (!label) return false
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('nav[aria-label="Command centre sections"] button'),
  )
  const button = buttons.find((item) => item.textContent?.trim().includes(label))
  button?.click()
  return Boolean(button)
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function focusAccountSearch(search = '') {
  clickCommandPanel('accounts')
  window.setTimeout(() => {
    const input = commandCentreRoot()?.querySelector<HTMLInputElement>(
      'input[placeholder="Search account, owner, service, subtype"]',
    )
    if (!input) return
    if (search) setReactInputValue(input, search)
    input.focus()
  }, 50)
}

function activateSavedView(title: string, panel: string) {
  clickCommandPanel(panel === 'queue' ? 'overview' : panel)
  window.setTimeout(() => {
    const root = commandCentreRoot()
    const button = Array.from(root?.querySelectorAll<HTMLButtonElement>('button') || []).find(
      (item) => item.textContent?.trim() === title,
    )
    button?.click()
  }, 75)
}

function splitValues(value: string) {
  return Array.from(
    new Set(value.split(',').map((item) => item.trim()).filter(Boolean)),
  )
}

function cents(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN
}

export function AdminProductivityConsole({ children }: { children: ReactNode }) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandResults, setCommandResults] = useState<CommandResult[]>([])
  const [searching, setSearching] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [offers, setOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [pricingMode, setPricingMode] = useState<'create' | 'version' | 'retire'>('create')
  const [sourceOffer, setSourceOffer] = useState<Offer | null>(null)
  const [offerForm, setOfferForm] = useState<OfferForm>(EMPTY_OFFER)
  const [pricingWorking, setPricingWorking] = useState(false)
  const gPressedAt = useRef(0)

  const loadCapabilities = useCallback(async () => {
    const response = await fetch('/api/admin/productivity?mode=overview', {
      cache: 'no-store',
    })
    const payload = (await response.json()) as {
      success?: boolean
      admin?: Capabilities
      error?: string
    }
    if (!response.ok || !payload.success || !payload.admin) {
      throw new Error(payload.error || 'Unable to load Admin productivity controls.')
    }
    return payload.admin
  }, [])

  const syncWork = useCallback(async (quiet = false) => {
    setSyncing(true)
    if (!quiet) setNotice(null)
    try {
      const response = await fetch('/api/admin/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_work_items' }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        result?: { created?: number; resolved?: number; active?: number }
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to synchronize operational work.')
      }
      if (!quiet) {
        setNotice(
          `Work synchronized · ${payload.result?.active ?? 0} active · ${payload.result?.created ?? 0} created · ${payload.result?.resolved ?? 0} resolved.`,
        )
      }
      return true
    } catch (error) {
      if (!quiet) {
        setNotice(error instanceof Error ? error.message : 'Unable to synchronize work.')
      }
      return false
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      try {
        const admin = await loadCapabilities()
        if (cancelled) return
        setCapabilities(admin)
        if (admin.canSyncWorkItems) {
          await syncWork(true)
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? error.message
              : 'Admin productivity controls are unavailable.',
          )
        }
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
    }
  }, [loadCapabilities, syncWork])

  useEffect(() => {
    if (!paletteOpen) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(
          `/api/admin/productivity?mode=search&q=${encodeURIComponent(commandQuery)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const payload = (await response.json()) as {
          success?: boolean
          results?: CommandResult[]
          error?: string
        }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Command search failed.')
        }
        setCommandResults(payload.results || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setNotice(error instanceof Error ? error.message : 'Command search failed.')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 140)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [commandQuery, paletteOpen])

  const runCommand = useCallback((result: CommandResult) => {
    setPaletteOpen(false)
    setCommandQuery('')
    if (result.href) {
      window.location.assign(result.href)
      return
    }
    if (result.kind === 'account' || result.kind === 'provider') {
      focusAccountSearch(result.search || result.title)
      return
    }
    if (result.kind === 'saved_view') {
      activateSavedView(result.title, result.panel || 'accounts')
      return
    }
    if (result.panel) clickCommandPanel(result.panel)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && paletteOpen) {
        event.preventDefault()
        setPaletteOpen(false)
        return
      }
      if (isEditableTarget(event.target)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        focusAccountSearch()
        return
      }
      const key = event.key.toLowerCase()
      const now = Date.now()
      if (key === 'g') {
        gPressedAt.current = now
        return
      }
      if (now - gPressedAt.current < 1200) {
        if (key === 'a') clickCommandPanel('accounts')
        if (key === 'p') clickCommandPanel('people')
        if (key === 'c') clickCommandPanel('commercial')
        gPressedAt.current = 0
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen])

  const loadOffers = useCallback(async () => {
    setOffersLoading(true)
    try {
      const response = await fetch('/api/admin/productivity?mode=offers', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as {
        success?: boolean
        offers?: Offer[]
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load pricing governance.')
      }
      setOffers(payload.offers || [])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load pricing governance.')
    } finally {
      setOffersLoading(false)
    }
  }, [])

  async function openPricing() {
    setPricingOpen(true)
    setPricingMode('create')
    setSourceOffer(null)
    setOfferForm(EMPTY_OFFER)
    await loadOffers()
  }

  function startVersion(offer: Offer) {
    setPricingMode('version')
    setSourceOffer(offer)
    setOfferForm({
      accountType: offer.accountType,
      offerCode: '',
      name: offer.name,
      description: offer.description,
      billingModel: offer.billingModel,
      legacyPlan: offer.legacyPlan,
      currency: offer.currency,
      monthlyCents: offer.monthlyCents === null ? '' : String(offer.monthlyCents),
      annualCents: offer.annualCents === null ? '' : String(offer.annualCents),
      departmentKeys: Array.isArray(offer.departmentKeys)
        ? offer.departmentKeys.join(', ')
        : '',
      entitlements: Array.isArray(offer.entitlements)
        ? offer.entitlements.join(', ')
        : '',
      selfService: offer.selfService,
      reason: '',
    })
  }

  function startRetire(offer: Offer) {
    setPricingMode('retire')
    setSourceOffer(offer)
    setOfferForm({ ...EMPTY_OFFER, reason: '' })
  }

  async function submitPricing() {
    const monthlyCents = cents(offerForm.monthlyCents)
    const annualCents = cents(offerForm.annualCents)
    if (Number.isNaN(monthlyCents) || Number.isNaN(annualCents)) {
      setNotice('Pricing values must be non-negative whole cents.')
      return
    }
    if (offerForm.reason.trim().length < 5) {
      setNotice('A pricing governance reason of at least 5 characters is required.')
      return
    }
    setPricingWorking(true)
    setNotice(null)
    try {
      const action =
        pricingMode === 'create'
          ? 'create_offer'
          : pricingMode === 'version'
            ? 'version_offer'
            : 'retire_offer'
      const payloadBody: Record<string, unknown> = {
        action,
        reason: offerForm.reason.trim(),
      }
      if (pricingMode === 'retire') {
        payloadBody.offerCode = sourceOffer?.offerCode
      } else {
        Object.assign(payloadBody, {
          offerCode: offerForm.offerCode.trim(),
          sourceOfferCode: sourceOffer?.offerCode,
          accountType: offerForm.accountType,
          name: offerForm.name.trim(),
          description: offerForm.description.trim(),
          billingModel: offerForm.billingModel,
          legacyPlan: offerForm.legacyPlan,
          currency: offerForm.currency.trim().toUpperCase(),
          monthlyCents,
          annualCents,
          departmentKeys: splitValues(offerForm.departmentKeys),
          entitlements: splitValues(offerForm.entitlements),
          selfService: offerForm.selfService,
        })
      }
      const response = await fetch('/api/admin/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })
      const payload = (await response.json()) as {
        success?: boolean
        offerCode?: string
        version?: number
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Pricing governance update failed.')
      }
      setNotice(
        pricingMode === 'retire'
          ? `Retired ${sourceOffer?.offerCode}. Existing account assignments remain unchanged.`
          : `Saved ${payload.offerCode}${payload.version ? ` · version ${payload.version}` : ''}.`,
      )
      setPricingMode('create')
      setSourceOffer(null)
      setOfferForm(EMPTY_OFFER)
      await loadOffers()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Pricing governance update failed.')
    } finally {
      setPricingWorking(false)
    }
  }

  function currentAccountFilters() {
    const input = commandCentreRoot()?.querySelector<HTMLInputElement>(
      'input[placeholder="Search account, owner, service, subtype"]',
    )
    const grid = input?.parentElement?.parentElement
    const selects = Array.from(grid?.querySelectorAll<HTMLSelectElement>('select') || [])
    return {
      q: input?.value || '',
      accountType: selects[0]?.value || 'all',
      subtype: selects[1]?.value || 'all',
    }
  }

  function downloadExport(screen: 'accounts' | 'queue' | 'people' | 'commercial') {
    const params = new URLSearchParams({ mode: 'export', screen })
    if (screen === 'accounts') {
      const filters = currentAccountFilters()
      params.set('q', filters.q)
      params.set('accountType', filters.accountType)
      params.set('subtype', filters.subtype)
    }
    const anchor = document.createElement('a')
    anchor.href = `/api/admin/productivity?${params.toString()}`
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const activeOffers = useMemo(
    () => offers.filter((offer) => offer.status === 'active'),
    [offers],
  )

  return (
    <>
      <section
        className="border-b border-gold/12 bg-espresso text-champagne"
        data-admin-productivity-console="true"
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-8">
          <Button
            variant="outline"
            onClick={() => setPaletteOpen(true)}
            className="min-h-10 border-gold/20 text-gold"
            aria-label="Open Admin command palette"
          >
            <Command className="size-4" />
            Command
            <span className="hidden rounded border border-gold/15 px-1.5 py-0.5 text-[9px] text-champagne/40 md:inline">
              Ctrl/⌘ K
            </span>
          </Button>

          {capabilities?.canSyncWorkItems && (
            <Button
              variant="outline"
              onClick={() => void syncWork(false)}
              disabled={syncing}
              className="min-h-10 border-gold/20 text-gold"
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync work
            </Button>
          )}

          {capabilities?.canReadBilling && (
            <Button
              variant="outline"
              onClick={() => void openPricing()}
              className="min-h-10 border-gold/20 text-gold"
            >
              <BadgeDollarSign className="size-4" />
              Pricing governance
            </Button>
          )}

          <details className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-gold/20 px-3 text-xs font-medium text-gold">
              <Download className="size-4" />
              Export
            </summary>
            <div className="absolute left-0 top-11 z-[80] min-w-48 rounded-lg border border-gold/20 bg-espresso p-1 shadow-2xl">
              {capabilities?.canExportAccounts && (
                <button className="block min-h-10 w-full rounded px-3 text-left text-xs hover:bg-white/[0.05]" onClick={() => downloadExport('accounts')}>
                  Accounts CSV
                </button>
              )}
              {capabilities?.canExportQueue && (
                <button className="block min-h-10 w-full rounded px-3 text-left text-xs hover:bg-white/[0.05]" onClick={() => downloadExport('queue')}>
                  Work queue CSV
                </button>
              )}
              {capabilities?.canExportPeople && (
                <button className="block min-h-10 w-full rounded px-3 text-left text-xs hover:bg-white/[0.05]" onClick={() => downloadExport('people')}>
                  Workforce CSV
                </button>
              )}
              {capabilities?.canExportCommercial && (
                <button className="block min-h-10 w-full rounded px-3 text-left text-xs hover:bg-white/[0.05]" onClick={() => downloadExport('commercial')}>
                  Pricing CSV
                </button>
              )}
            </div>
          </details>

          <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-champagne/35 lg:flex">
            <Keyboard className="size-3.5" />
            G A accounts · G P people · G C commercial · / search
          </span>
        </div>
        {notice && (
          <div className="mx-auto max-w-[1500px] px-3 pb-2 text-[10px] text-champagne/55 sm:px-8">
            {notice}
          </div>
        )}
      </section>

      {initializing ? (
        <div className="flex min-h-32 items-center justify-center bg-espresso text-gold">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        children
      )}

      {paletteOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 p-3 backdrop-blur-sm sm:p-8" role="presentation">
          <button className="absolute inset-0 cursor-default" aria-label="Close Admin command palette" onClick={() => setPaletteOpen(false)} />
          <div
            className="relative mx-auto mt-[8vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gold/20 bg-espresso text-champagne shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Admin command palette"
          >
            <div className="flex items-center gap-2 border-b border-gold/12 p-3">
              <Search className="size-4 text-gold" />
              <Input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search accounts, providers, people, views, or Admin destinations"
                className="min-h-11 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button variant="ghost" onClick={() => setPaletteOpen(false)} className="min-h-10 min-w-10 px-2" aria-label="Close command palette">
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {searching && <div className="flex justify-center p-4 text-gold"><Loader2 className="size-5 animate-spin" /></div>}
              {!searching && commandResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => runCommand(result)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{result.title}</span>
                    <span className="block truncate text-[10px] text-champagne/40">{result.subtitle}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-gold/12 px-2 py-1 text-[9px] uppercase tracking-wider text-gold">{result.kind.replaceAll('_', ' ')}</span>
                </button>
              ))}
              {!searching && !commandResults.length && (
                <p className="p-6 text-center text-xs text-champagne/40">No authorized results match this command.</p>
              )}
            </div>
            <div className="border-t border-gold/10 px-3 py-2 text-[9px] text-champagne/35">
              Results are server-scoped to your Platform Administrator role. Esc closes.
            </div>
          </div>
        </div>
      )}

      {pricingOpen && (
        <div className="fixed inset-0 z-[115] bg-black/70 backdrop-blur-sm" role="presentation">
          <button className="absolute inset-0 cursor-default" aria-label="Close pricing governance" onClick={() => setPricingOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-gold/20 bg-espresso text-champagne shadow-2xl" role="dialog" aria-modal="true" aria-label="Pricing governance">
            <header className="flex items-center justify-between gap-3 border-b border-gold/12 p-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-gold">Commercial governance</p>
                <h3 className="mt-1 text-lg font-semibold">Versioned pricing offers</h3>
                <p className="mt-1 text-[10px] text-champagne/40">Existing account assignments always retain their historical offer row.</p>
              </div>
              <Button variant="outline" onClick={() => setPricingOpen(false)} className="min-h-10 min-w-10 border-gold/20 px-2" aria-label="Close pricing governance"><X className="size-4" /></Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {offersLoading ? (
                <div className="flex justify-center p-8 text-gold"><Loader2 className="size-6 animate-spin" /></div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <p className="text-xs text-champagne/45">{offers.length} offer versions · {activeOffers.length} active</p>
                    {capabilities?.canManageBilling && (
                      <Button variant="outline" onClick={() => { setPricingMode('create'); setSourceOffer(null); setOfferForm(EMPTY_OFFER) }} className="min-h-10 border-gold/20 text-gold">New offer</Button>
                    )}
                  </div>

                  {capabilities?.canManageBilling && (
                    <div className="mb-4 rounded-xl border border-gold/15 bg-white/[0.025] p-3">
                      <p className="text-xs font-semibold">
                        {pricingMode === 'create' ? 'Create offer' : pricingMode === 'version' ? `Version ${sourceOffer?.offerCode}` : `Retire ${sourceOffer?.offerCode}`}
                      </p>
                      {pricingMode === 'retire' ? (
                        <div className="mt-3 space-y-2">
                          <textarea value={offerForm.reason} onChange={(event) => setOfferForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason for retiring this offer" className="min-h-20 w-full rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-xs" />
                          <Button disabled={pricingWorking || offerForm.reason.trim().length < 5} onClick={() => void submitPricing()} className="bg-gold text-espresso hover:bg-gold-light">{pricingWorking && <Loader2 className="size-4 animate-spin" />}Retire offer</Button>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {pricingMode === 'create' && <Input value={offerForm.offerCode} onChange={(event) => setOfferForm((current) => ({ ...current, offerCode: event.target.value.toLowerCase() }))} placeholder="offer_code" className="min-h-10 border-gold/20 bg-black/15 text-xs" />}
                          <select disabled={pricingMode === 'version'} value={offerForm.accountType} onChange={(event) => setOfferForm((current) => ({ ...current, accountType: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-xs">
                            {['couple','planning_company','venue','vendor','client'].map((value) => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
                          </select>
                          <Input value={offerForm.name} onChange={(event) => setOfferForm((current) => ({ ...current, name: event.target.value }))} placeholder="Offer name" className="min-h-10 border-gold/20 bg-black/15 text-xs" />
                          <Input value={offerForm.currency} onChange={(event) => setOfferForm((current) => ({ ...current, currency: event.target.value.toUpperCase().slice(0,3) }))} placeholder="USD" className="min-h-10 border-gold/20 bg-black/15 text-xs" />
                          <select value={offerForm.billingModel} onChange={(event) => setOfferForm((current) => ({ ...current, billingModel: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-xs">
                            {['free','subscription','contract'].map((value) => <option key={value}>{value}</option>)}
                          </select>
                          <select value={offerForm.legacyPlan} onChange={(event) => setOfferForm((current) => ({ ...current, legacyPlan: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-xs">
                            {['free','starter','professional','enterprise'].map((value) => <option key={value}>{value}</option>)}
                          </select>
                          <Input value={offerForm.monthlyCents} onChange={(event) => setOfferForm((current) => ({ ...current, monthlyCents: event.target.value }))} placeholder="Monthly cents" inputMode="numeric" className="min-h-10 border-gold/20 bg-black/15 text-xs" />
                          <Input value={offerForm.annualCents} onChange={(event) => setOfferForm((current) => ({ ...current, annualCents: event.target.value }))} placeholder="Annual cents" inputMode="numeric" className="min-h-10 border-gold/20 bg-black/15 text-xs" />
                          <Input value={offerForm.departmentKeys} onChange={(event) => setOfferForm((current) => ({ ...current, departmentKeys: event.target.value }))} placeholder="Department keys, comma separated" className="min-h-10 border-gold/20 bg-black/15 text-xs sm:col-span-2" />
                          <Input value={offerForm.entitlements} onChange={(event) => setOfferForm((current) => ({ ...current, entitlements: event.target.value }))} placeholder="Entitlements, comma separated" className="min-h-10 border-gold/20 bg-black/15 text-xs sm:col-span-2" />
                          <textarea value={offerForm.description} onChange={(event) => setOfferForm((current) => ({ ...current, description: event.target.value }))} placeholder="Commercial description" className="min-h-20 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-xs sm:col-span-2" />
                          <label className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={offerForm.selfService} onChange={(event) => setOfferForm((current) => ({ ...current, selfService: event.target.checked }))} /> Self-service eligible</label>
                          <Input value={offerForm.reason} onChange={(event) => setOfferForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Governance reason" className="min-h-10 border-gold/20 bg-black/15 text-xs" />
                          <Button disabled={pricingWorking || offerForm.reason.trim().length < 5 || !offerForm.name.trim() || (pricingMode === 'create' && !offerForm.offerCode.trim())} onClick={() => void submitPricing()} className="bg-gold text-espresso hover:bg-gold-light sm:col-span-2 sm:w-fit">{pricingWorking && <Loader2 className="size-4 animate-spin" />}{pricingMode === 'create' ? 'Create offer' : 'Create new version'}</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2 md:grid-cols-2">
                    {offers.map((offer) => (
                      <div key={offer.offerCode} className="rounded-xl border border-gold/12 bg-black/10 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate text-sm font-semibold">{offer.name}</p><p className="mt-1 truncate text-[9px] text-gold">{offer.offerCode} · v{offer.version} · {offer.accountType.replaceAll('_',' ')}</p></div>
                          <span className="rounded-full border border-gold/15 px-2 py-1 text-[9px] uppercase text-champagne/55">{offer.status}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[10px] text-champagne/45">{offer.description}</p>
                        <p className="mt-2 text-[10px] text-champagne/40">{offer.billingModel} · {offer.assignmentCount} historical/current assignments</p>
                        {capabilities?.canManageBilling && offer.status === 'active' && (
                          <div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => startVersion(offer)} className="min-h-9 border-gold/20 px-3 text-[10px] text-gold">New version</Button><Button variant="outline" onClick={() => startRetire(offer)} className="min-h-9 border-rose-300/20 px-3 text-[10px] text-rose-100">Retire</Button></div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
