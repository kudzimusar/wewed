'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ArrowLeft, FileText, Loader2, LockKeyhole, RefreshCw, Upload } from 'lucide-react'

interface VaultLinkRow {
  id: string
  entityType: string
  entityId: string
  linkRole: string
  createdAt: string
}

interface VaultObjectRow {
  id: string
  displayName: string
  originalFilename: string
  mimeType: string
  extension: string | null
  byteSize: number
  checksumSha256: string
  uploadSource: string
  storageState: string
  scanState: string
  sensitivity: string
  publicationState: string
  retentionClass: string
  legalHold: boolean
  category: string
  createdAt: string
  archivedAt: string | null
  available: boolean
  links: VaultLinkRow[]
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function VaultWorkspace({ weddingId }: { weddingId?: string | null }) {
  const [items, setItems] = useState<VaultObjectRow[]>([])
  const [canUpload, setCanUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('wedding_document')

  const query = useMemo(() => weddingId ? `?weddingId=${encodeURIComponent(weddingId)}` : '', [weddingId])

  const load = useCallback(async () => {
    setError(null)
    const response = await fetch(`/api/vault${query}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => null) as {
      success?: boolean
      data?: VaultObjectRow[]
      context?: { canUpload?: boolean }
      error?: string
    } | null
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Unable to load Wewed Vault.')
    }
    setItems(payload.data ?? [])
    setCanUpload(Boolean(payload.context?.canUpload))
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load Wewed Vault.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [load])

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (!file || uploading) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      if (weddingId) form.append('weddingId', weddingId)
      const response = await fetch('/api/vault', { method: 'POST', body: form })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Vault upload failed.')
      setFile(null)
      const input = document.getElementById('wewed-vault-upload') as HTMLInputElement | null
      if (input) input.value = ''
      await load()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Vault upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function openFile(item: VaultObjectRow) {
    if (!item.available || openingId) return
    setOpeningId(item.id)
    setError(null)
    try {
      const response = await fetch(`/api/vault/${encodeURIComponent(item.id)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        data?: { signedUrl?: string }
        error?: string
      } | null
      if (!response.ok || !payload?.success || !payload.data?.signedUrl) {
        throw new Error(payload?.error || 'Could not authorize this Vault file.')
      }
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open this Vault file.')
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-6 text-espresso sm:px-6 lg:px-8" data-wewed-vault-workspace="true">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/15 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/planner" className="inline-flex size-10 items-center justify-center rounded-full text-espresso/60 hover:bg-champagne/40" aria-label="Back to workspace">
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2"><Archive className="size-5 text-gold" /><h1 className="font-serif text-2xl font-semibold">Wewed Vault</h1></div>
              <p className="text-xs text-espresso/50">Private wedding documents, evidence and media references in one governed record.</p>
            </div>
          </div>
          <button type="button" onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : 'Refresh failed.'))} className="inline-flex items-center gap-2 rounded-full border border-gold/20 px-3 py-2 text-xs font-semibold text-espresso/65 hover:bg-champagne/30">
            <RefreshCw className="size-4" /> Refresh
          </button>
        </header>

        {error ? <div role="alert" className="rounded-xl border border-clay/25 bg-clay/10 px-4 py-3 text-sm">{error}</div> : null}

        {canUpload ? (
          <form onSubmit={upload} className="grid gap-3 rounded-2xl border border-gold/15 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto] sm:items-end" data-wewed-vault-upload-form="true">
            <label className="text-xs font-semibold text-espresso/65">Private file
              <input id="wewed-vault-upload" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx" className="mt-1 block w-full rounded-xl border border-gold/15 bg-ivory/40 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-espresso/65">Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-gold/15 bg-white px-3 text-sm">
                <option value="wedding_document">Wedding document</option>
                <option value="inspiration">Inspiration</option>
                <option value="couple_media">Couple media</option>
              </select>
            </label>
            <button type="submit" disabled={!file || uploading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-sm font-semibold text-champagne disabled:opacity-40">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
            </button>
            <p className="text-[11px] text-espresso/45 sm:col-span-3">PDF, JPEG, PNG, WebP, TXT and CSV are content-validated for private access. DOCX/XLSX can be stored but remain quarantined until a real scanner clears them.</p>
          </form>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-gold/15 bg-white shadow-sm">
          <div className="border-b border-gold/10 px-4 py-3"><h2 className="font-semibold">Wedding files</h2><p className="text-xs text-espresso/45">{items.length} governed object{items.length === 1 ? '' : 's'}</p></div>
          {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-espresso/50"><Loader2 className="size-4 animate-spin" /> Loading Vault…</div> : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-espresso/50"><LockKeyhole className="mx-auto mb-2 size-7 text-gold/45" />No governed files have been added to this wedding yet.</div>
          ) : (
            <div className="divide-y divide-gold/10">
              {items.map((item) => (
                <article key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-vault-object-id={item.id}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-gold" /><h3 className="truncate text-sm font-semibold">{item.displayName}</h3></div>
                    <p className="mt-1 text-xs text-espresso/45">{item.category.replaceAll('_', ' ')} · {formatBytes(item.byteSize)} · {formatDate(item.createdAt)} · {item.uploadSource.replaceAll('_', ' ')}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-espresso/30" title={item.checksumSha256}>SHA-256 {item.checksumSha256}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.links.map((link) => <span key={link.id} className="rounded-full bg-champagne/40 px-2 py-1 text-[10px] font-semibold text-espresso/55">{link.linkRole.replaceAll('_', ' ')}</span>)}
                      {!item.available ? <span className="rounded-full bg-clay/10 px-2 py-1 text-[10px] font-semibold text-clay-light">Security review required</span> : null}
                      {item.legalHold ? <span className="rounded-full bg-gold/15 px-2 py-1 text-[10px] font-semibold">Legal hold</span> : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => void openFile(item)} disabled={!item.available || openingId === item.id} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-gold/20 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                    {openingId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyhole className="size-3.5" />}{item.available ? 'Open securely' : 'Quarantined'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
