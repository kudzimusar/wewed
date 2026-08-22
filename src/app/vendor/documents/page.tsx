'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, FolderLock, Loader2, Search, ShieldCheck } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface VendorDocument {
  id: string
  linkRole: string
  displayName: string
  originalFilename: string
  mimeType: string
  byteSize: number
  storageState: string
  scanState: string
  createdAt: string
  serviceEngagement: {
    id: string
    serviceCategory: string
    serviceDescription: string | null
    lifecycleStatus: string
  } | null
  vendor: { id: string; name: string; category: string } | null
  wedding: { id: string; title: string; date: string } | null
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function VendorDocumentsPage() {
  return (
    <DashboardAuthGate
      allowedRoles={['vendor']}
      wrongRoleMessage="This document workspace is available to approved Wewed Vendor accounts."
      title="Vendor documents"
      description="Open private documents only for Service Engagements where your Vendor account is the recorded service provider."
      onClose={() => { window.location.href = '/vendor' }}
    >
      <VendorDocumentsContent />
    </DashboardAuthGate>
  )
}

function VendorDocumentsContent() {
  const [documents, setDocuments] = useState<VendorDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    void fetch('/api/vendor/documents', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || body.success === false) throw new Error(body.error || 'Could not load documents.')
        setDocuments(body.data ?? [])
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load documents.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents
    return documents.filter((document) => [
      document.displayName,
      document.originalFilename,
      document.linkRole,
      document.vendor?.name ?? '',
      document.serviceEngagement?.serviceCategory ?? '',
      document.serviceEngagement?.serviceDescription ?? '',
      document.wedding?.title ?? '',
    ].some((value) => value.toLowerCase().includes(query)))
  }, [documents, search])

  async function openDocument(document: VendorDocument) {
    setError('')
    try {
      const response = await fetch(`/api/vendor/documents/${document.id}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || body.success === false || !body.data?.signedUrl) throw new Error(body.error || 'Document unavailable.')
      window.open(body.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document unavailable.')
    }
  }

  return (
    <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/vendor" className="inline-flex items-center gap-2 text-xs font-semibold text-gold-muted"><ArrowLeft className="size-4" />Vendor workspace</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Private commercial records</p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Documents & contracts</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-espresso/60">These files come from Service Engagements where your account is the recorded service provider. Wewed stores one authoritative Vault object and exposes it here without giving the Vendor account access to unrelated wedding documents.</p>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-champagne/60 px-4 py-3 text-xs text-espresso/65"><ShieldCheck className="mb-2 size-5 text-gold-muted" />Relationship-scoped access</div>
        </div>

        <div className="mt-8 rounded-3xl border border-gold/20 bg-white p-4 shadow-sm sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-espresso/35" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filename, wedding, service or document type" className="border-gold/25 bg-ivory pl-9" />
          </div>

          {error && <div role="alert" className="mt-4 rounded-xl border border-clay/25 bg-clay/5 px-4 py-3 text-sm text-clay">{error}</div>}
          {loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div> : filtered.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gold/25 px-6 py-14 text-center"><FolderLock className="mx-auto size-7 text-gold-muted" /><p className="mt-3 font-serif text-2xl">No documents in this view</p><p className="mt-2 text-sm text-espresso/50">Documents appear only when they are linked to a Service Engagement that identifies this Vendor account as the service provider.</p></div>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {filtered.map((document) => <div key={`${document.id}-${document.serviceEngagement?.id ?? 'unknown'}`} className="rounded-2xl border border-gold/20 bg-ivory/55 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-gold-muted" /><p className="truncate text-sm font-semibold">{document.displayName}</p></div><p className="mt-1 text-xs text-espresso/45">{titleCase(document.linkRole)} · {Math.max(1, Math.round(document.byteSize / 1024))} KB</p></div><Button type="button" size="sm" variant="outline" onClick={() => void openDocument(document)} className="shrink-0 border-gold/25 bg-white"><ExternalLink className="size-3.5" />Open</Button></div><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div><p className="text-espresso/40">Wedding</p><p className="mt-0.5 font-medium">{document.wedding?.title ?? 'Wedding'}</p></div><div><p className="text-espresso/40">Service</p><p className="mt-0.5 font-medium">{document.serviceEngagement ? titleCase(document.serviceEngagement.serviceCategory) : 'Service Engagement'}</p></div></div>{document.serviceEngagement?.serviceDescription && <p className="mt-3 text-xs leading-5 text-espresso/55">{document.serviceEngagement.serviceDescription}</p>}</div>)}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
