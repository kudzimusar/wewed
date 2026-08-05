'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  FileSearch,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type WorkspaceTab = 'templates' | 'drafts' | 'actions' | 'documents'

type RecordEnvelope<T> = {
  id: string
  key: string
  status: string
  createdAt: string
  updatedAt: string
  value: T
}

type TemplateValue = {
  templateId: string
  version: number
  name: string
  description: string
  content: string
  items: unknown[]
  anonymized: boolean
}

type DraftValue = {
  draftId: string
  title: string
  audience: string
  channel: string
  subject: string | null
  body: string
}

type ProposalValue = {
  proposalId: string
  type: string
  summary: string
  preview: Record<string, unknown>
  failure: string | null
}

type DocumentRow = {
  id: string
  documentId: string
  title: string
  kind: string
  sourceUrl: string | null
  visibility: 'private' | 'public'
  retentionUntil: string | null
  checksum: string
  chunkCount: number
  indexedAt: string
  updatedAt: string
}

const TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'drafts', label: 'Drafts', icon: Save },
  { id: 'actions', label: 'Review queue', icon: ShieldCheck },
  { id: 'documents', label: 'Documents', icon: Database },
]

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with HTTP ${response.status}`)
  }
  return payload
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function objectSummary(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : String(item)}`)
    .join(' · ')
}

export function AiWorkspaceRecords() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('actions')
  const [templates, setTemplates] = useState<RecordEnvelope<TemplateValue>[]>([])
  const [drafts, setDrafts] = useState<RecordEnvelope<DraftValue>[]>([])
  const [actions, setActions] = useState<RecordEnvelope<ProposalValue>[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [documentTitle, setDocumentTitle] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [documentKind, setDocumentKind] = useState('other')
  const [documentVisibility, setDocumentVisibility] = useState<'private' | 'public'>('private')
  const [documentSourceUrl, setDocumentSourceUrl] = useState('')
  const [retentionUntil, setRetentionUntil] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    documentId: string
    title: string
    excerpt: string
    sourceUrl: string | null
    visibility: string
    score: number
  }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [templateResponse, draftResponse, actionResponse, documentResponse] =
        await Promise.all([
          fetch('/api/ai/templates', { cache: 'no-store' }),
          fetch('/api/ai/drafts', { cache: 'no-store' }),
          fetch('/api/ai/actions', { cache: 'no-store' }),
          fetch('/api/ai/documents', { cache: 'no-store' }),
        ])

      const [templatePayload, draftPayload, actionPayload, documentPayload] =
        await Promise.all([
          readJson<{ data: { latest: RecordEnvelope<TemplateValue>[] } }>(templateResponse),
          readJson<{ data: RecordEnvelope<DraftValue>[] }>(draftResponse),
          readJson<{ data: RecordEnvelope<ProposalValue>[] }>(actionResponse),
          readJson<{ data: DocumentRow[] }>(documentResponse),
        ])

      setTemplates(templatePayload.data.latest)
      setDrafts(draftPayload.data)
      setActions(actionPayload.data)
      setDocuments(documentPayload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load AI workspace records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (id: string, status: 'approved' | 'rejected' | 'executed') => {
      setBusyId(id)
      setError(null)
      setNotice(null)
      try {
        const payload = await readJson<{ result?: Record<string, unknown> }>(
          await fetch('/api/ai/actions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
          }),
        )
        setNotice(
          status === 'executed'
            ? `Action executed${payload.result ? `: ${objectSummary(payload.result)}` : '.'}`
            : `Action ${status}.`,
        )
        await load()
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Unable to update action.')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const proposeTemplate = useCallback(
    async (template: RecordEnvelope<TemplateValue>) => {
      setBusyId(template.id)
      setError(null)
      try {
        await readJson(
          await fetch('/api/ai/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'propose_apply',
              versionId: template.id,
              name: template.value.name,
              itemCount: template.value.items.length,
            }),
          }),
        )
        setNotice('Template application proposal added to the review queue.')
        setActiveTab('actions')
        await load()
      } catch (proposalError) {
        setError(proposalError instanceof Error ? proposalError.message : 'Unable to propose template application.')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const proposeDraft = useCallback(
    async (draft: RecordEnvelope<DraftValue>, action: 'propose_approval' | 'propose_reminder') => {
      setBusyId(draft.id)
      setError(null)
      try {
        await readJson(
          await fetch('/api/ai/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              draftId: draft.id,
              audience: 'pending',
            }),
          }),
        )
        setNotice(
          action === 'propose_reminder'
            ? 'Reminder conversion added to the review queue.'
            : 'Draft approval added to the review queue.',
        )
        setActiveTab('actions')
        await load()
      } catch (proposalError) {
        setError(proposalError instanceof Error ? proposalError.message : 'Unable to create draft proposal.')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const ingestDocument = useCallback(async () => {
    setBusyId('document-form')
    setError(null)
    setNotice(null)
    try {
      await readJson(
        await fetch('/api/ai/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ingest',
            title: documentTitle,
            text: documentText,
            kind: documentKind,
            visibility: documentVisibility,
            sourceUrl: documentSourceUrl || null,
            retentionUntil: retentionUntil || null,
          }),
        }),
      )
      setDocumentTitle('')
      setDocumentText('')
      setDocumentSourceUrl('')
      setRetentionUntil('')
      setNotice('Document indexed successfully.')
      await load()
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'Unable to index document.')
    } finally {
      setBusyId(null)
    }
  }, [documentKind, documentSourceUrl, documentText, documentTitle, documentVisibility, load, retentionUntil])

  const readFile = useCallback(async (file: File | null) => {
    if (!file) return
    const allowed = ['text/plain', 'text/markdown', 'text/csv', 'application/json']
    if (!allowed.includes(file.type) && !/\.(txt|md|markdown|csv|json)$/i.test(file.name)) {
      setError('This browser importer accepts TXT, Markdown, CSV, and JSON. Extract PDF or DOCX text before indexing.')
      return
    }
    if (file.size > 1_000_000) {
      setError('Document files must be 1 MB or smaller for browser text import.')
      return
    }
    setDocumentTitle((current) => current || file.name.replace(/\.[^.]+$/, ''))
    setDocumentText(await file.text())
  }, [])

  const searchDocuments = useCallback(async () => {
    if (!searchQuery.trim()) return
    setBusyId('search')
    setError(null)
    try {
      const payload = await readJson<{ data: typeof searchResults }>(
        await fetch(`/api/ai/documents?q=${encodeURIComponent(searchQuery.trim())}`, {
          cache: 'no-store',
        }),
      )
      setSearchResults(payload.data)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Document search failed.')
    } finally {
      setBusyId(null)
    }
  }, [searchQuery, searchResults])

  const proposePublish = useCallback(
    async (document: DocumentRow) => {
      setBusyId(document.documentId)
      setError(null)
      try {
        await readJson(
          await fetch('/api/ai/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'propose_publish',
              documentId: document.documentId,
            }),
          }),
        )
        setNotice('Document publication proposal added to the review queue.')
        setActiveTab('actions')
        await load()
      } catch (publishError) {
        setError(publishError instanceof Error ? publishError.message : 'Unable to propose publication.')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const deleteDocument = useCallback(
    async (document: DocumentRow) => {
      if (!window.confirm(`Delete “${document.title}” and all indexed chunks?`)) return
      setBusyId(document.documentId)
      setError(null)
      try {
        await readJson(
          await fetch('/api/ai/documents', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: document.documentId }),
          }),
        )
        setNotice('Document and index chunks deleted.')
        await load()
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete document.')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const pendingActions = useMemo(
    () => actions.filter((action) => action.status === 'proposed' || action.status === 'approved'),
    [actions],
  )

  return (
    <section className="flex min-h-[640px] flex-col rounded-2xl border border-gold/20 bg-espresso text-champagne shadow-2xl">
      <header className="border-b border-gold/15 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="wewed-heading text-lg text-champagne">AI Records & Review</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-champagne/55">
              Durable templates, communication drafts, human-confirmed actions, and permission-aware document retrieval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-3 py-2 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const count =
              tab.id === 'templates'
                ? templates.length
                : tab.id === 'drafts'
                  ? drafts.length
                  : tab.id === 'actions'
                    ? pendingActions.length
                    : documents.length
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                  activeTab === tab.id
                    ? 'border-gold/60 bg-gold/10 text-gold'
                    : 'border-gold/15 text-champagne/65 hover:border-gold/35 hover:bg-gold/5',
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4" />
                  {tab.label}
                </span>
                <span className="rounded-full bg-champagne/10 px-2 py-0.5 text-[10px]">{count}</span>
              </button>
            )
          })}
        </div>
      </header>

      {(error || notice) && (
        <div className="px-4 pt-4">
          <div
            className={cn(
              'flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-xs',
              error
                ? 'border-red-400/30 bg-red-400/10 text-red-100'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
            )}
          >
            <span>{error || notice}</span>
            <button type="button" onClick={() => { setError(null); setNotice(null) }}>
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="wewed-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-champagne/55">
            <Loader2 className="size-5 animate-spin text-gold" />
            Loading AI workspace records…
          </div>
        ) : activeTab === 'templates' ? (
          <div className="space-y-3">
            {templates.length === 0 && <EmptyState text="No saved AI template versions yet." />}
            {templates.map((template) => (
              <RecordCard
                key={template.id}
                title={`${template.value.name} · v${template.value.version}`}
                meta={`${template.value.items.length} structured items · ${template.value.anonymized ? 'anonymized' : 'review anonymization'}`}
                status={template.status}
                expanded={expanded === template.id}
                onToggle={() => setExpanded((current) => current === template.id ? null : template.id)}
                actions={
                  <button
                    type="button"
                    onClick={() => void proposeTemplate(template)}
                    disabled={busyId === template.id || template.value.items.length === 0}
                    className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShieldCheck className="size-3" />
                    Propose apply
                  </button>
                }
              >
                <p className="text-xs text-champagne/65">{template.value.description || 'No description.'}</p>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-[11px] leading-relaxed text-champagne/75">
                  {template.value.content}
                </pre>
              </RecordCard>
            ))}
          </div>
        ) : activeTab === 'drafts' ? (
          <div className="space-y-3">
            {drafts.length === 0 && <EmptyState text="No persistent communication drafts yet." />}
            {drafts.map((draft) => (
              <RecordCard
                key={draft.id}
                title={draft.value.title}
                meta={`${draft.value.channel} · ${draft.value.audience} · updated ${formatDate(draft.updatedAt)}`}
                status={draft.status}
                expanded={expanded === draft.id}
                onToggle={() => setExpanded((current) => current === draft.id ? null : draft.id)}
                actions={
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void proposeDraft(draft, 'propose_approval')}
                      disabled={busyId === draft.id}
                      className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
                    >
                      <Check className="size-3" />
                      Propose approval
                    </button>
                    {draft.value.channel === 'email' && (
                      <button
                        type="button"
                        onClick={() => void proposeDraft(draft, 'propose_reminder')}
                        disabled={busyId === draft.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
                      >
                        <Send className="size-3" />
                        Propose reminder
                      </button>
                    )}
                  </div>
                }
              >
                {draft.value.subject && <p className="mb-2 text-xs font-semibold text-gold-light">Subject: {draft.value.subject}</p>}
                <pre className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-[11px] leading-relaxed text-champagne/75">
                  {draft.value.body}
                </pre>
              </RecordCard>
            ))}
          </div>
        ) : activeTab === 'actions' ? (
          <div className="space-y-3">
            {actions.length === 0 && <EmptyState text="No AI action proposals have been created." />}
            {actions.map((action) => (
              <RecordCard
                key={action.id}
                title={action.value.summary}
                meta={`${action.value.type.replaceAll('_', ' ')} · created ${formatDate(action.createdAt)}`}
                status={action.status}
                expanded={expanded === action.id}
                onToggle={() => setExpanded((current) => current === action.id ? null : action.id)}
                actions={
                  <div className="flex flex-wrap gap-1.5">
                    {action.status === 'proposed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void runAction(action.id, 'approved')}
                          disabled={busyId === action.id}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 px-2.5 py-1 text-[10px] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
                        >
                          <Check className="size-3" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void runAction(action.id, 'rejected')}
                          disabled={busyId === action.id}
                          className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 text-[10px] text-red-200 hover:bg-red-400/10 disabled:opacity-40"
                        >
                          <X className="size-3" /> Reject
                        </button>
                      </>
                    )}
                    {action.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => void runAction(action.id, 'executed')}
                        disabled={busyId === action.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/20 disabled:opacity-40"
                      >
                        <Play className="size-3" /> Execute confirmed action
                      </button>
                    )}
                  </div>
                }
              >
                <p className="text-[11px] text-champagne/60">{objectSummary(action.value.preview)}</p>
                {action.value.failure && <p className="mt-2 text-[11px] text-red-200">Failure: {action.value.failure}</p>}
              </RecordCard>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-gold/15 bg-champagne/[0.025] p-4">
              <h3 className="font-sans text-sm font-semibold text-champagne">Index a workspace document</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-champagne/50">
                Add extracted text from contracts, venue manuals, proposals, wedding briefs, or policies. Private is the safe default.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Document title" className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold" />
                <select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)} className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold">
                  <option value="contract">Contract</option>
                  <option value="venue_manual">Venue manual</option>
                  <option value="proposal">Proposal</option>
                  <option value="wedding_brief">Wedding brief</option>
                  <option value="policy">Policy</option>
                  <option value="other">Other</option>
                </select>
                <input value={documentSourceUrl} onChange={(event) => setDocumentSourceUrl(event.target.value)} placeholder="Source URL (optional)" className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold" />
                <input type="date" value={retentionUntil} onChange={(event) => setRetentionUntil(event.target.value)} className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold" />
                <select value={documentVisibility} onChange={(event) => setDocumentVisibility(event.target.value as 'private' | 'public')} className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold">
                  <option value="private">Private planner retrieval</option>
                  <option value="public">Public Guest Concierge retrieval</option>
                </select>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/30 px-3 py-2 text-xs text-gold hover:bg-gold/5">
                  <Upload className="size-4" />
                  Import text file
                  <input type="file" accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} rows={8} placeholder="Paste or import extracted document text…" className="mt-3 w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold" />
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => void ingestDocument()} disabled={busyId === 'document-form' || !documentTitle.trim() || documentText.trim().length < 20} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-espresso hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40">
                  {busyId === 'document-form' ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                  Index document
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gold/15 bg-champagne/[0.025] p-4">
              <div className="flex gap-2">
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchDocuments() }} placeholder="Search indexed documents…" className="min-w-0 flex-1 rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm outline-none focus:border-gold" />
                <button type="button" onClick={() => void searchDocuments()} disabled={!searchQuery.trim() || busyId === 'search'} className="inline-flex items-center gap-2 rounded-lg border border-gold/25 px-3 py-2 text-xs text-gold hover:bg-gold/10 disabled:opacity-40">
                  <FileSearch className="size-4" /> Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((result) => (
                    <div key={`${result.documentId}-${result.excerpt}`} className="rounded-lg border border-gold/10 bg-black/15 p-3">
                      <p className="text-xs font-semibold text-gold-light">{result.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-champagne/60">{result.excerpt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {documents.length === 0 && <EmptyState text="No indexed workspace documents yet." />}
              {documents.map((document) => (
                <RecordCard
                  key={document.documentId}
                  title={document.title}
                  meta={`${document.kind.replaceAll('_', ' ')} · ${document.chunkCount} chunks · indexed ${formatDate(document.indexedAt)}`}
                  status={document.visibility}
                  expanded={expanded === document.documentId}
                  onToggle={() => setExpanded((current) => current === document.documentId ? null : document.documentId)}
                  actions={
                    <div className="flex flex-wrap gap-1.5">
                      {document.visibility === 'private' && (
                        <button type="button" onClick={() => void proposePublish(document)} disabled={busyId === document.documentId} className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40">
                          <ShieldCheck className="size-3" /> Propose public access
                        </button>
                      )}
                      <button type="button" onClick={() => void deleteDocument(document)} disabled={busyId === document.documentId} className="inline-flex items-center gap-1 rounded-full border border-red-400/25 px-2.5 py-1 text-[10px] text-red-200 hover:bg-red-400/10 disabled:opacity-40">
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </div>
                  }
                >
                  <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
                    <div><dt className="text-champagne/35">Document ID</dt><dd className="break-all text-champagne/70">{document.documentId}</dd></div>
                    <div><dt className="text-champagne/35">Retention until</dt><dd className="text-champagne/70">{formatDate(document.retentionUntil)}</dd></div>
                    <div><dt className="text-champagne/35">Checksum</dt><dd className="break-all text-champagne/70">{document.checksum}</dd></div>
                    <div><dt className="text-champagne/35">Source</dt><dd className="break-all text-champagne/70">{document.sourceUrl || '—'}</dd></div>
                  </dl>
                </RecordCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-gold/20 p-6 text-center">
      <Archive className="size-6 text-gold/50" />
      <p className="mt-2 text-xs text-champagne/45">{text}</p>
    </div>
  )
}

function RecordCard({
  title,
  meta,
  status,
  expanded,
  onToggle,
  actions,
  children,
}: {
  title: string
  meta: string
  status: string
  expanded: boolean
  onToggle: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <article className="rounded-xl border border-gold/15 bg-champagne/[0.025]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-semibold text-champagne">{title}</span>
            <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold">{status}</span>
          </div>
          <p className="mt-1 text-[10px] text-champagne/40">{meta}</p>
        </button>
        <div className="flex items-center gap-2">
          {actions}
          <button type="button" onClick={onToggle} aria-label={expanded ? 'Collapse record' : 'Expand record'} className="rounded-full p-1.5 text-champagne/45 hover:bg-gold/10 hover:text-gold">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>
      {expanded && <div className="border-t border-gold/10 p-3">{children}</div>}
    </article>
  )
}

export default AiWorkspaceRecords
