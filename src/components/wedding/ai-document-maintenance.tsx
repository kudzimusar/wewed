'use client'

import { useCallback, useEffect, useState } from 'react'
import { DatabaseZap, Loader2, RefreshCw, Trash2 } from 'lucide-react'

interface DocumentRow {
  documentId: string
  title: string
  chunkCount: number
  visibility: string
  retentionUntil: string | null
  indexedAt: string
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload
}

export function AiDocumentMaintenance() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const payload = await readJson<{ data: DocumentRow[] }>(
        await fetch('/api/ai/documents', { cache: 'no-store' }),
      )
      setDocuments(payload.data)
    } catch {
      setDocuments([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reindex = async (document: DocumentRow) => {
    setBusy(document.documentId)
    setMessage(null)
    setError(null)
    try {
      await readJson(
        await fetch('/api/ai/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reindex', documentId: document.documentId }),
        }),
      )
      setMessage(`Reindexed “${document.title}”.`)
      await load()
    } catch (reindexError) {
      setError(reindexError instanceof Error ? reindexError.message : 'Unable to reindex document.')
    } finally {
      setBusy(null)
    }
  }

  const deleteExpired = async () => {
    setBusy('expired')
    setMessage(null)
    setError(null)
    try {
      const payload = await readJson<{ data: unknown[] }>(
        await fetch('/api/ai/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_expired' }),
        }),
      )
      setMessage(`Deleted ${payload.data.length} expired document${payload.data.length === 1 ? '' : 's'}.`)
      await load()
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : 'Unable to delete expired documents.')
    } finally {
      setBusy(null)
    }
  }

  if (documents.length === 0) return null

  return (
    <section className="mb-4 rounded-2xl border border-gold/20 bg-champagne/[0.035] p-4 text-champagne">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wewed-heading text-base">Document index maintenance</h2>
          <p className="mt-1 text-xs text-champagne/50">
            Rebuild retrieval chunks after a document change and enforce configured retention dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void deleteExpired()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-full border border-red-400/25 px-3 py-2 text-xs text-red-100 hover:bg-red-400/10 disabled:opacity-40"
        >
          {busy === 'expired' ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete expired
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <div key={document.documentId} className="flex items-center justify-between gap-3 rounded-xl border border-gold/15 bg-espresso/45 p-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-champagne">{document.title}</p>
              <p className="mt-1 text-[10px] text-champagne/40">
                {document.chunkCount} chunks · {document.visibility}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reindex(document)}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/20 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10 disabled:opacity-40"
            >
              {busy === document.documentId ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Reindex
            </button>
          </div>
        ))}
      </div>

      {(message || error) && (
        <p className={`mt-3 text-xs ${error ? 'text-red-200' : 'text-emerald-200'}`}>
          {error || message}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-champagne/35">
        <DatabaseZap className="size-3.5 text-gold/60" />
        Full-text search indexes update automatically when chunks are rebuilt.
      </div>
    </section>
  )
}

export default AiDocumentMaintenance
