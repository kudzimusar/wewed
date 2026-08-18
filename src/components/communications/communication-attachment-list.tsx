'use client'

import { useState } from 'react'
import { FileText, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react'

export interface CommunicationAttachmentView {
  id: string
  messageId: string
  vaultObjectId: string
  filename: string
  displayName: string
  mimeType: string
  byteSize: number
  caption: string | null
  position: number
  state: 'available' | 'quarantined'
  createdAt: string
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function CommunicationAttachmentList(props: {
  attachments: CommunicationAttachmentView[]
  weddingId: string | null
  role: 'admin' | 'couple' | 'planner' | 'vendor' | null
  onError: (message: string | null) => void
}) {
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  async function openAttachment(attachment: CommunicationAttachmentView) {
    if (attachment.state !== 'available' || openingId) return
    setOpeningId(attachment.id)
    props.onError(null)
    try {
      const response = await fetch(`/api/communications/attachments/${encodeURIComponent(attachment.id)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        data?: { signedUrl?: string }
        error?: string
      } | null
      if (!response.ok || !payload?.success || !payload.data?.signedUrl) {
        throw new Error(payload?.error || 'Could not authorize this attachment.')
      }
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Could not open this attachment.')
    } finally {
      setOpeningId(null)
    }
  }

  async function addToWedding(attachment: CommunicationAttachmentView) {
    if (!props.weddingId || props.role === 'vendor' || promotingId) return
    setPromotingId(attachment.id)
    props.onError(null)
    try {
      const response = await fetch(`/api/communications/attachments/${encodeURIComponent(attachment.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'wedding',
          entityId: props.weddingId,
          linkRole: 'wedding_document',
        }),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Could not add this file to wedding documents.')
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Could not add this file to wedding documents.')
    } finally {
      setPromotingId(null)
    }
  }

  if (props.attachments.length === 0) return null

  return (
    <div className="mt-2 space-y-1.5" data-communication-attachments="true">
      {props.attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-xl border border-current/10 bg-black/[0.04] p-2.5">
          <div className="flex items-start gap-2">
            {attachment.state === 'available' ? <FileText className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{attachment.displayName}</p>
              <p className="text-[10px] opacity-60">{fileSize(attachment.byteSize)} · {attachment.state === 'available' ? 'Private Vault file' : 'Security review required'}</p>
              {attachment.caption ? <p className="mt-1 whitespace-pre-wrap text-[11px] opacity-75">{attachment.caption}</p> : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={attachment.state !== 'available' || openingId === attachment.id}
              onClick={() => void openAttachment(attachment)}
              className="inline-flex items-center gap-1 rounded-full border border-current/15 px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {openingId === attachment.id ? <Loader2 className="size-3 animate-spin" /> : <LockKeyhole className="size-3" />}
              {attachment.state === 'available' ? 'Open securely' : 'Quarantined'}
            </button>
            {props.weddingId && props.role !== 'vendor' ? (
              <button
                type="button"
                disabled={promotingId === attachment.id}
                onClick={() => void addToWedding(attachment)}
                className="inline-flex items-center gap-1 rounded-full border border-current/15 px-2 py-1 text-[10px] font-semibold disabled:opacity-45"
              >
                {promotingId === attachment.id ? <Loader2 className="size-3 animate-spin" /> : null}
                Add to wedding documents
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
