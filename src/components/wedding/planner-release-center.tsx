'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Circle,
  FileCheck2,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

type Severity = 'critical' | 'high' | 'medium' | 'low'

interface Recommendation {
  id: string
  title: string
  reason: string
  evidence: string
  severity: Severity
  module: string
  task: {
    title: string
    category: string
    priority: 'high' | 'medium' | 'low'
  } | null
}

interface ReadinessCheck {
  id: string
  label: string
  detail: string
  complete: boolean
  blocking: boolean
  count?: number
}

interface Evaluation {
  ready: boolean
  checks: ReadinessCheck[]
  completed: number
  total: number
  datePassed?: boolean
}

interface ReleaseCentrePayload {
  success: boolean
  generatedAt: string
  wedding: {
    id: string
    title: string
    date: string
    lifecycle: string
    privacy: string
    canonSealed: boolean
    canonSealedAt: string | null
  }
  permissions: {
    canEdit: boolean
    canManageCanon: boolean
  }
  intelligence: {
    externalModel: boolean
    explanation: string
    recommendations: Recommendation[]
  }
  closeout: Evaluation
  release: Evaluation
  error?: string
}

interface HealthPayload {
  ok?: boolean
  checks?: Record<string, unknown>
  timestamp?: string
}

function severityClass(value: Severity): string {
  if (value === 'critical') return 'border-clay/50 bg-clay/15 text-clay-light'
  if (value === 'high') return 'border-amber-400/40 bg-amber-400/10 text-amber-200'
  if (value === 'medium') return 'border-gold/35 bg-gold/10 text-gold'
  return 'border-sage/35 bg-sage/10 text-sage-light'
}

function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3">
      {check.complete ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage-light" />
      ) : check.blocking ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-clay-light" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-champagne/35" />
      )}
      <div className="min-w-0">
        <p className="font-sans text-sm text-champagne">{check.label}</p>
        <p className="mt-1 font-sans text-xs leading-5 text-champagne/45">{check.detail}</p>
      </div>
    </div>
  )
}

export function PlannerReleaseCenter() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReleaseCentrePayload | null>(null)
  const [health, setHealth] = useState<HealthPayload | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const [centreResponse, healthResponse] = await Promise.all([
        fetch('/api/planner/release-center', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }).catch(() => null),
      ])
      const payload = (await centreResponse.json()) as ReleaseCentrePayload
      if (!centreResponse.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load the release centre.')
      }
      setData(payload)
      if (healthResponse) {
        setHealth((await healthResponse.json().catch(() => null)) as HealthPayload | null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the release centre.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load(true)
  }, [open, load])

  async function runAction(
    action: string,
    body: Record<string, unknown>,
    successTitle: string,
  ) {
    setBusy(action)
    setError(null)
    try {
      const response = await fetch('/api/planner/release-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        duplicate?: boolean
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'The release-centre action failed.')
      }
      toast({
        title: payload.duplicate ? 'Task already exists' : successTitle,
        description: payload.duplicate
          ? 'The active wedding already has an open task for this recommendation.'
          : undefined,
      })
      await load(false)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'The action failed.'
      setError(message)
      toast({ title: 'Action failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  function confirmation(): string | null {
    if (!data) return null
    return window.prompt(`Type “${data.wedding.title}” to confirm.`)
  }

  function createRecommendationTask(item: Recommendation) {
    if (!item.task || !data?.permissions.canEdit) return
    if (!window.confirm(`Create the task “${item.task.title}” for this wedding?`)) return
    void runAction(
      'create_recommendation_task',
      { recommendationId: item.id },
      'Recommendation added to Tasks',
    )
  }

  function completeCloseout() {
    const value = confirmation()
    if (value === null) return
    void runAction('complete_closeout', { confirmation: value }, 'Post-wedding closeout completed')
  }

  function manageCanon(action: 'seal_canon' | 'reopen_canon') {
    const value = confirmation()
    if (value === null) return
    void runAction(
      action,
      { confirmation: value },
      action === 'seal_canon' ? 'Wedding canon sealed' : 'Wedding canon reopened',
    )
  }

  const closeoutPercent = data?.closeout.total
    ? Math.round((data.closeout.completed / data.closeout.total) * 100)
    : 0
  const releasePercent = data?.release.total
    ? Math.round((data.release.completed / data.release.total) * 100)
    : 0

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Open planner intelligence, closeout, and release checks"
        className="gap-1.5 border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
      >
        <BrainCircuit className="size-3.5" />
        <span className="hidden lg:inline">Intelligence</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[94vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4 sm:px-6">
            <div>
              <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
                <Sparkles className="size-5 text-gold" />
                Planner Intelligence & Release Centre
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl text-champagne/50">
                Explainable selected-wedding recommendations, post-event closeout, canon controls, and release checks.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load(true)}
              disabled={loading}
              className="shrink-0 border-gold/25 bg-transparent"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {error && (
            <div className="mx-5 mt-3 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light sm:mx-6">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-gold" />
            </div>
          ) : data ? (
            <Tabs defaultValue="intelligence" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-5 mt-3 h-auto flex-wrap justify-start bg-transparent sm:mx-6">
                <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
                <TabsTrigger value="closeout">Closeout</TabsTrigger>
                <TabsTrigger value="release">Release</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
                <TabsContent value="intelligence" className="space-y-4">
                  <div className="rounded-xl border border-gold/15 bg-gold/5 p-4">
                    <p className="flex items-center gap-2 font-sans text-sm text-gold">
                      <ShieldCheck className="size-4" />
                      Wedding-scoped and explainable
                    </p>
                    <p className="mt-2 font-sans text-xs leading-5 text-champagne/50">
                      {data.intelligence.explanation}
                    </p>
                  </div>

                  {data.intelligence.recommendations.length === 0 ? (
                    <div className="rounded-xl border border-sage/25 bg-sage/5 p-8 text-center">
                      <CheckCircle2 className="mx-auto size-8 text-sage-light" />
                      <p className="mt-3 font-serif text-xl">No active recommendations</p>
                      <p className="mt-1 font-sans text-xs text-champagne/45">
                        The selected wedding has no current evidence-backed planner risks.
                      </p>
                    </div>
                  ) : (
                    data.intelligence.recommendations.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gold/12 bg-espresso/45 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={`text-[9px] ${severityClass(item.severity)}`}>
                                {item.severity}
                              </Badge>
                              <Badge variant="outline" className="border-gold/20 text-[9px] text-gold-muted">
                                {item.module}
                              </Badge>
                            </div>
                            <h3 className="mt-2 font-serif text-lg text-champagne">{item.title}</h3>
                            <p className="mt-1 font-sans text-xs leading-5 text-champagne/55">{item.reason}</p>
                            <p className="mt-2 rounded-md border border-gold/10 bg-espresso/55 px-3 py-2 font-sans text-xs text-champagne/70">
                              Evidence: {item.evidence}
                            </p>
                          </div>
                          {item.task && data.permissions.canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy !== null}
                              onClick={() => createRecommendationTask(item)}
                              className="shrink-0 bg-gold text-espresso hover:bg-gold-light"
                            >
                              {busy === 'create_recommendation_task' ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <FileCheck2 className="size-3.5" />
                              )}
                              Create task
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="closeout" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-gold/15 bg-gold/5 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/70">Lifecycle</p>
                      <p className="mt-2 font-serif text-2xl capitalize">{data.wedding.lifecycle}</p>
                    </div>
                    <div className="rounded-xl border border-gold/15 bg-gold/5 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/70">Closeout</p>
                      <p className="mt-2 font-serif text-2xl">{closeoutPercent}%</p>
                      <Progress value={closeoutPercent} className="mt-2 h-1.5" />
                    </div>
                    <div className="rounded-xl border border-gold/15 bg-gold/5 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/70">Canon</p>
                      <p className="mt-2 flex items-center gap-2 font-serif text-xl">
                        <LockKeyhole className="size-4 text-gold" />
                        {data.wedding.canonSealed ? 'Sealed' : 'Open'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {data.closeout.checks.map((check) => <CheckRow key={check.id} check={check} />)}
                  </div>

                  <div className="flex flex-wrap gap-2 rounded-xl border border-gold/15 bg-espresso/45 p-4">
                    {data.wedding.lifecycle !== 'after' && (
                      <Button
                        type="button"
                        disabled={!data.permissions.canEdit || !data.closeout.ready || busy !== null}
                        onClick={completeCloseout}
                        className="bg-gold text-espresso hover:bg-gold-light"
                      >
                        {busy === 'complete_closeout' ? <Loader2 className="size-4 animate-spin" /> : <HeartHandshake className="size-4" />}
                        Complete closeout
                      </Button>
                    )}
                    {data.permissions.canManageCanon && data.wedding.lifecycle === 'after' && !data.wedding.canonSealed && (
                      <Button
                        type="button"
                        disabled={!data.closeout.ready || busy !== null}
                        onClick={() => manageCanon('seal_canon')}
                        variant="outline"
                        className="border-gold/30 bg-transparent text-gold"
                      >
                        {busy === 'seal_canon' ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                        Seal canon
                      </Button>
                    )}
                    {data.permissions.canManageCanon && data.wedding.canonSealed && (
                      <Button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => manageCanon('reopen_canon')}
                        variant="outline"
                        className="border-clay/30 bg-transparent text-clay-light"
                      >
                        {busy === 'reopen_canon' ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                        Reopen canon
                      </Button>
                    )}
                    {!data.closeout.ready && (
                      <p className="self-center font-sans text-xs text-champagne/45">
                        Clear every blocking check before closeout or canon sealing.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="release" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-gold/15 bg-gold/5 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/70">Wedding data readiness</p>
                      <p className="mt-2 font-serif text-3xl">{releasePercent}%</p>
                      <Progress value={releasePercent} className="mt-3 h-1.5" />
                    </div>
                    <div className={`rounded-xl border p-4 ${health?.ok ? 'border-sage/25 bg-sage/5' : 'border-clay/25 bg-clay/5'}`}>
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-champagne/50">System health</p>
                      <p className="mt-2 flex items-center gap-2 font-serif text-2xl">
                        {health?.ok ? <CheckCircle2 className="size-5 text-sage-light" /> : <AlertTriangle className="size-5 text-clay-light" />}
                        {health?.ok ? 'Healthy' : 'Needs attention'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {data.release.checks.map((check) => <CheckRow key={check.id} check={check} />)}
                  </div>

                  <div className="rounded-xl border border-gold/15 bg-espresso/45 p-4">
                    <p className="flex items-center gap-2 font-sans text-sm text-gold">
                      <ShieldCheck className="size-4" />
                      Release decision
                    </p>
                    <p className="mt-2 font-sans text-xs leading-5 text-champagne/50">
                      {data.release.ready && health?.ok
                        ? 'Wedding data checks and system health are ready for the release runbook.'
                        : 'Resolve failed wedding checks and system health items before promoting the release.'}
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
