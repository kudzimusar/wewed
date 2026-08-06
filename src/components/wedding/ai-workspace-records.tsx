'use client'

import type { ReactNode } from 'react'
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
  channel: 'email' | 'whatsapp' | 'sms' | 'internal' | 'speech'
  subject: string | null
  body: string
}

type ProposalValue = {
  proposalId: string
  type: string
  summary: string
  preview: Record<string, unknown>
  failure: string | null
  executionId?: string | null
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

type SearchResult = {
  documentId: string
  title: string
  excerpt: string
  sourceUrl: string | null
  visibility: string
  score: number
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
    .map(([key, item]) => {
      const rendered =
        item && typeof item === 'object'
          ? JSON.stringify(item)
          : String(item)
      return `${key}: ${rendered}`
    })
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
  const [documentSourceUrl, setDocumentSourceUrl] = useState('')
  const [retentionUntil, setRetentionUntil] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

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
          readJson<{ data: { latest: RecordEnvelope<TemplateValue>[] } }>(
            templateResponse,
          ),
          readJson<{ data: RecordEnvelope<DraftValue>[] }>(draftResponse),
          readJson<{ data: RecordEnvelope<ProposalValue>[] }>(actionResponse),
          readJson<{ data: DocumentRow[] }>(documentResponse),
        ])

      setTemplates(templatePayload.data.latest)
      setDrafts(draftPayload.data)
      setActions(actionPayload.data)
      setDocuments(documentPayload.data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load AI workspace records.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refresh = () => void load()
    window.addEventListener('wewed:ai-records-refresh', refresh)
    return () => window.removeEventListener('wewed:ai-records-refresh', refresh)
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
            ? `Confirmed action executed${payload.result ? `: ${objectSummary(payload.result)}` : '.'}`
            : `Action ${status}.`,
        )
        await load()
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Unable to update action.',
        )
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
            }),
          }),
        )
        setNotice('Template application proposal added to the review queue.')
        setActiveTab('actions')
        await load()
      } catch (proposalError) {
        setError(
          proposalError instanceof Error
            ? proposalError.message
            : 'Unable to propose template application.',
        )
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const proposeDraft = useCallback(
    async (
      draft: RecordEnvelope<DraftValue>,
      action: 'propose_approval' | 'propose_reminder',
    ) => {
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
        setError(
          proposalError instanceof Error
            ? proposalError.message
            : 'Unable to create draft proposal.',
        )
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
            sourceUrl: documentSourceUrl || null,
            retentionUntil: retentionUntil || null,
          }),
        }),
      )
      setDocumentTitle('')
      setDocumentText('')
      setDocumentSourceUrl('')
      setRetentionUntil('')
      setNotice(
        'Document indexed privately. Public retrieval requires a separate reviewed publication proposal.',
      )
      await load()
    } catch (ingestError) {
      setError(
        ingestError instanceof Error
          ? ingestError.message
          : 'Unable to index document.',
      )
    } finally {
      setBusyId(null)
    }
  }, [
    documentKind,
    documentSourceUrl,
    documentText,
    documentTitle,
    load,
    retentionUntil,
  ])

  const readFile = useCallback(async (file: File | null) => {
    if (!file) return
    const allowed = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ]
    if (
      !allowed.includes(file.type) &&
      !/\.(txt|md|markdown|csv|json)$/i.test(file.name)
    ) {
      setError(
        'This importer accepts TXT, Markdown, CSV, and JSON. Extract PDF or DOCX text before indexing.',
      )
      return
    }
    if (file.size > 1_000_000) {
      setError('Document files must be 1 MB or smaller for browser import.')
      return
    }
    setDocumentTitle((current) =>
      current || file.name.replace(/\.[^.]+$/, ''),
    )
    setDocumentText(await file.text())
  }, [])

  const searchDocuments = useCallback(async () => {
    if (!searchQuery.trim()) return
    setBusyId('search')
    setError(null)
    try {
      const payload = await readJson<{ data: SearchResult[] }>(
        await fetch(
          `/api/ai/documents?q=${encodeURIComponent(searchQuery.trim())}`,
          { cache: 'no-store' },
        ),
      )
      setSearchResults(payload.data)
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Document search failed.',
      )
    } finally {
      setBusyId(null)
    }
  }, [searchQuery])

  const documentAction = useCallback(
    async (
      document: DocumentRow,
      action: 'propose_publish' | 'reindex' | 'delete',
    ) => {
      if (
        action === 'delete' &&
        !window.confirm(`Delete “${document.title}” and all indexed chunks?`)
      ) {
        return
      }
      setBusyId(document.documentId)
      setError(null)
      setNotice(null)
      try {
        if (action === 'delete') {
          await readJson(
            await fetch('/api/ai/documents', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ documentId: document.documentId }),
            }),
          )
          setNotice('Document and index chunks deleted.')
        } else {
          await readJson(
            await fetch('/api/ai/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action,
                documentId: document.documentId,
              }),
            }),
          )
          setNotice(
            action === 'propose_publish'
              ? 'Publication proposal added to the review queue.'
              : 'Document reindexed from its canonical source.',
          )
          if (action === 'propose_publish') setActiveTab('actions')
        }
        await load()
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Document action failed.',
        )
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const pendingActions = useMemo(
    () =>
      actions.filter((action) =>
        ['proposed', 'approved', 'executing', 'failed'].includes(action.status),
      ),
    [actions],
  )

  return (
    <section className="flex min-h-[640px] flex-col rounded-2xl border border-gold/20 bg-espresso text-champagne shadow-2xl">
      <header className="border-b border-gold/15 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="wewed-heading text-lg text-champagne">
              AI Records & Review
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-champagne/55">
              Durable versions and drafts, explicit approval, single-claim
              execution, and private-first document retrieval.
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
                <span className="rounded-full bg-champagne/10 px-2 py-0.5 text-[10px]">
                  {count}
                </span>
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
            <button
              type="button"
              onClick={() => {
                setError(null)
                setNotice(null)
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="wewed-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingState />
        ) : activeTab === 'templates' ? (
          <div className="space-y-3">
            {templates.length === 0 && (
              <EmptyState text="No reviewed AI template versions yet." />
            )}
            {templates.map((template) => (
              <RecordCard
                key={template.id}
                title={`${template.value.name} · v${template.value.version}`}
                meta={`${template.value.items.length} validated items · ${template.value.anonymized ? 'anonymization reviewed' : 'not reusable'}`}
                status={template.status}
                expanded={expanded === template.id}
                onToggle={() =>
                  setExpanded((current) =>
                    current === template.id ? null : template.id,
                  )
                }
                actions={
                  <button
                    type="button"
                    onClick={() => void proposeTemplate(template)}
                    disabled={
                      busyId === template.id ||
                      template.value.items.length === 0 ||
                      !template.value.anonymized
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
                  >
                    <ShieldCheck className="size-3" /> Propose apply
                  </button>
                }
              >
                <p className="text-xs text-champagne/65">
                  {template.value.description || 'No description.'}
                </p>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-[11px] leading-relaxed text-champagne/75">
                  {template.value.content}
                </pre>
              </RecordCard>
            ))}
          </div>
        ) : activeTab === 'drafts' ? (
          <div className="space-y-3">
            {drafts.length === 0 && (
              <EmptyState text="No persistent communication drafts yet." />
            )}
            {drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                busy={busyId === draft.id}
                expanded={expanded === draft.id}
                onToggle={() =>
                  setExpanded((current) =>
                    current === draft.id ? null : draft.id,
                  )
                }
                onPropose={(action) => void proposeDraft(draft, action)}
                onSaved={async () => {
                  setNotice('Draft changes saved.')
                  await load()
                }}
                onError={setError}
                setBusy={setBusyId}
              />
            ))}
          </div>
        ) : activeTab === 'actions' ? (
          <div className="space-y-3">
            {actions.length === 0 && (
              <EmptyState text="No AI action proposals have been created." />
            )}
            {actions.map((action) => (
              <RecordCard
                key={action.id}
                title={action.value.summary}
                meta={`${action.value.type.replaceAll('_', ' ')} · created ${formatDate(action.createdAt)}`}
                status={action.status}
                expanded={expanded === action.id}
                onToggle={() =>
                  setExpanded((current) =>
                    current === action.id ? null : action.id,
                  )
                }
                actions={
                  <div className="flex flex-wrap gap-1.5">
                    {(action.status === 'proposed' || action.status === 'failed') && (
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
                    {action.status === 'executing' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-champagne/45">
                        <Loader2 className="size-3 animate-spin" /> Execution claimed
                      </span>
                    )}
                  </div>
                }
              >
                <p className="text-[11px] text-champagne/60">
                  {objectSummary(action.value.preview)}
                </p>
                {action.value.executionId && (
                  <p className="mt-2 break-all text-[10px] text-champagne/35">
                    Execution claim: {action.value.executionId}
                  </p>
                )}
                {action.value.failure && (
                  <p className="mt-2 text-[11px] text-red-200">
                    Failure: {action.value.failure}
                  </p>
                )}
              </RecordCard>
            ))}
          </div>
        ) : (
          <DocumentPanel
            documentTitle={documentTitle}
            setDocumentTitle={setDocumentTitle}
            documentText={documentText}
            setDocumentText={setDocumentText}
            documentKind={documentKind}
            setDocumentKind={setDocumentKind}
            documentSourceUrl={documentSourceUrl}
            setDocumentSourceUrl={setDocumentSourceUrl}
            retentionUntil={retentionUntil}
            setRetentionUntil={setRetentionUntil}
            busyId={busyId}
            ingestDocument={ingestDocument}
            readFile={readFile}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchDocuments={searchDocuments}
            searchResults={searchResults}
            documents={documents}
            expanded={expanded}
            setExpanded={setExpanded}
            documentAction={documentAction}
          />
        )}
      </div>
    </section>
  )
}

function DraftCard({
  draft,
  busy,
  expanded,
  onToggle,
  onPropose,
  onSaved,
  onError,
  setBusy,
}: {
  draft: RecordEnvelope<DraftValue>
  busy: boolean
  expanded: boolean
  onToggle: () => void
  onPropose: (action: 'propose_approval' | 'propose_reminder') => void
  onSaved: () => Promise<void>
  onError: (message: string | null) => void
  setBusy: (id: string | null) => void
}) {
  const [title, setTitle] = useState(draft.value.title)
  const [audience, setAudience] = useState(draft.value.audience)
  const [subject, setSubject] = useState(draft.value.subject ?? '')
  const [body, setBody] = useState(draft.value.body)
  const editable = draft.status === 'draft'

  const save = async () => {
    setBusy(draft.id)
    onError(null)
    try {
      await readJson(
        await fetch('/api/ai/drafts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draft.id,
            title,
            audience,
            subject: subject || null,
            body,
          }),
        }),
      )
      await onSaved()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to save draft.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <RecordCard
      title={draft.value.title}
      meta={`${draft.value.channel} · ${draft.value.audience} · updated ${formatDate(draft.updatedAt)}`}
      status={draft.status}
      expanded={expanded}
      onToggle={onToggle}
      actions={
        <div className="flex flex-wrap gap-1.5">
          {draft.status === 'draft' && (
            <button
              type="button"
              onClick={() => onPropose('propose_approval')}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
            >
              <Check className="size-3" /> Propose approval
            </button>
          )}
          {draft.value.channel === 'email' &&
            ['draft', 'approved'].includes(draft.status) && (
              <button
                type="button"
                onClick={() => onPropose('propose_reminder')}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
              >
                <Send className="size-3" /> Propose reminder
              </button>
            )}
        </div>
      }
    >
      {editable ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-xs"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-xs"
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-xs"
            />
          </div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-xs"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-espresso disabled:opacity-40"
            >
              <Save className="size-3.5" /> Save draft changes
            </button>
          </div>
        </div>
      ) : (
        <>
          {draft.value.subject && (
            <p className="mb-2 text-xs font-semibold text-gold-light">
              Subject: {draft.value.subject}
            </p>
          )}
          <pre className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-[11px] leading-relaxed text-champagne/75">
            {draft.value.body}
          </pre>
          <p className="mt-2 text-[10px] text-champagne/35">
            Approved or archived drafts are immutable. Create a new draft for
            further changes. No delivery occurred in this review surface.
          </p>
        </>
      )}
    </RecordCard>
  )
}

function DocumentPanel(props: {
  documentTitle: string
  setDocumentTitle: (value: string) => void
  documentText: string
  setDocumentText: (value: string) => void
  documentKind: string
  setDocumentKind: (value: string) => void
  documentSourceUrl: string
  setDocumentSourceUrl: (value: string) => void
  retentionUntil: string
  setRetentionUntil: (value: string) => void
  busyId: string | null
  ingestDocument: () => Promise<void>
  readFile: (file: File | null) => Promise<void>
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchDocuments: () => Promise<void>
  searchResults: SearchResult[]
  documents: DocumentRow[]
  expanded: string | null
  setExpanded: (value: string | null) => void
  documentAction: (
    document: DocumentRow,
    action: 'propose_publish' | 'reindex' | 'delete',
  ) => Promise<void>
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gold/15 bg-champagne/[0.025] p-4">
        <h3 className="text-sm font-semibold text-champagne">
          Index a private workspace document
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-champagne/50">
          Every new document is private. Guest access is possible only after a
          publication proposal is reviewed, approved and executed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={props.documentTitle}
            onChange={(event) => props.setDocumentTitle(event.target.value)}
            placeholder="Document title"
            className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
          />
          <select
            value={props.documentKind}
            onChange={(event) => props.setDocumentKind(event.target.value)}
            className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
          >
            <option value="contract">Contract</option>
            <option value="venue_manual">Venue manual</option>
            <option value="proposal">Proposal</option>
            <option value="wedding_brief">Wedding brief</option>
            <option value="policy">Policy</option>
            <option value="other">Other</option>
          </select>
          <input
            value={props.documentSourceUrl}
            onChange={(event) => props.setDocumentSourceUrl(event.target.value)}
            placeholder="Source URL (optional)"
            className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={props.retentionUntil}
            onChange={(event) => props.setRetentionUntil(event.target.value)}
            className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-xs text-gold">
            <ShieldCheck className="size-4" /> Private planner retrieval
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/30 px-3 py-2 text-xs text-gold hover:bg-gold/5">
            <Upload className="size-4" /> Import text file
            <input
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json"
              className="sr-only"
              onChange={(event) =>
                void props.readFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
        <textarea
          value={props.documentText}
          onChange={(event) => props.setDocumentText(event.target.value)}
          rows={8}
          placeholder="Paste or import extracted document text…"
          className="mt-3 w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void props.ingestDocument()}
            disabled={
              props.busyId === 'document-form' ||
              !props.documentTitle.trim() ||
              props.documentText.trim().length < 20
            }
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-espresso disabled:opacity-40"
          >
            {props.busyId === 'document-form' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Database className="size-4" />
            )}
            Index privately
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gold/15 bg-champagne/[0.025] p-4">
        <div className="flex gap-2">
          <input
            value={props.searchQuery}
            onChange={(event) => props.setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void props.searchDocuments()
            }}
            placeholder="Search authorised indexed documents…"
            className="min-w-0 flex-1 rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void props.searchDocuments()}
            disabled={!props.searchQuery.trim() || props.busyId === 'search'}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/25 px-3 py-2 text-xs text-gold disabled:opacity-40"
          >
            <FileSearch className="size-4" /> Search
          </button>
        </div>
        {props.searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {props.searchResults.map((result, index) => (
              <div
                key={`${result.documentId}-${index}`}
                className="rounded-lg border border-gold/10 bg-black/15 p-3"
              >
                <p className="text-xs font-semibold text-gold-light">
                  {result.title} · {result.visibility}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-champagne/60">
                  {result.excerpt}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {props.documents.length === 0 && (
          <EmptyState text="No indexed workspace documents yet." />
        )}
        {props.documents.map((document) => (
          <RecordCard
            key={document.documentId}
            title={document.title}
            meta={`${document.kind.replaceAll('_', ' ')} · ${document.chunkCount} chunks · indexed ${formatDate(document.indexedAt)}`}
            status={document.visibility}
            expanded={props.expanded === document.documentId}
            onToggle={() =>
              props.setExpanded(
                props.expanded === document.documentId
                  ? null
                  : document.documentId,
              )
            }
            actions={
              <div className="flex flex-wrap gap-1.5">
                {document.visibility === 'private' && (
                  <button
                    type="button"
                    onClick={() =>
                      void props.documentAction(document, 'propose_publish')
                    }
                    disabled={props.busyId === document.documentId}
                    className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold disabled:opacity-40"
                  >
                    <ShieldCheck className="size-3" /> Propose public access
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void props.documentAction(document, 'reindex')}
                  disabled={props.busyId === document.documentId}
                  className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-2.5 py-1 text-[10px] text-gold disabled:opacity-40"
                >
                  <RefreshCw className="size-3" /> Reindex
                </button>
                <button
                  type="button"
                  onClick={() => void props.documentAction(document, 'delete')}
                  disabled={props.busyId === document.documentId}
                  className="inline-flex items-center gap-1 rounded-full border border-red-400/25 px-2.5 py-1 text-[10px] text-red-200 disabled:opacity-40"
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              </div>
            }
          >
            <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
              <Detail term="Document ID" value={document.documentId} />
              <Detail
                term="Retention until"
                value={formatDate(document.retentionUntil)}
              />
              <Detail term="Checksum" value={document.checksum} />
              <Detail term="Source" value={document.sourceUrl || '—'} />
            </dl>
          </RecordCard>
        ))}
      </div>
    </div>
  )
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-champagne/35">{term}</dt>
      <dd className="break-all text-champagne/70">{value}</dd>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-champagne/55">
      <Loader2 className="size-5 animate-spin text-gold" />
      Loading AI workspace records…
    </div>
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
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <article className="rounded-xl border border-gold/15 bg-champagne/[0.025]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-semibold text-champagne">
              {title}
            </span>
            <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold">
              {status}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-champagne/40">{meta}</p>
        </button>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse record' : 'Expand record'}
            className="rounded-full p-1.5 text-champagne/45 hover:bg-gold/10 hover:text-gold"
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>
      </div>
      {expanded && <div className="border-t border-gold/10 p-3">{children}</div>}
    </article>
  )
}

export default AiWorkspaceRecords
