'use client'

import { useState } from 'react'
import {
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Music2,
  ShieldAlert,
} from 'lucide-react'

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

function AttachmentIcon({ attachment }: { attachment: CommunicationAttachmentView }) {
  if (attachment.state !== 'available') return <ShieldAlert className="size-4" />
  if (attachment.mimeType.startsWith('image/')) return <ImageIcon className="size-4" />
  if (attachment.mimeType.startsWith('video/')) return <Film className="size-4" />
  if (attachment.mimeType.startsWith('audio/')) return <Music2 className="size-4" />
  return <FileText className="size-4" />
}

function mediaLabel(attachment: CommunicationAttachmentView) {
  if (attachment.mimeType.startsWith('image/')) return 'Image'
  if (attachment.mimeType.startsWith('video/')) return 'Video'
  if (attachment.mimeType.startsWith('audio/')) return 'Audio'
  return 'File'
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
      {props.attachments.map((attachment) => {
        const attachmentNameId = `communication-attachment-${attachment.id}-name`
        return (
          <div key={attachment.id} className="rounded-xl border border-current/10 bg-black/[0.035] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-current/10 bg-white/10">
                <AttachmentIcon attachment={attachment} />
              </div>
              <div className="min-w-0 flex-1">
                <p id={attachmentNameId} className="truncate text-xs font-semibold">{attachment.displayName}</p>
                <p className="text-[10px] opacity-55">
                  {mediaLabel(attachment)} · {fileSize(attachment.byteSize)} · {attachment.state === 'available' ? 'Private Vault' : 'Security review'}
                </p>
                {attachment.caption ? <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] opacity-70">{attachment.caption}</p> : null}
              </div>
              <button
                type="button"
                disabled={attachment.state !== 'available' || openingId === attachment.id}
                onClick={() => void openAttachment(attachment)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-current/15 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={attachment.state === 'available' ? 'Open securely' : 'Quarantined'}
                aria-describedby={attachmentNameId}
                title={attachment.state === 'available' ? 'Open securely' : 'Quarantined'}
              >
                {openingId === attachment.id ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyhole className="size-3.5" />}
              </button>
            </div>

            {props.weddingId && props.role !== 'vendor' && attachment.state === 'available' ? (
              <button
                type="button"
                disabled={promotingId === attachment.id}
                onClick={() => void addToWedding(attachment)}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 disabled:opacity-40"
              >
                {promotingId === attachment.id ? <Loader2 className="size-3 animate-spin" /> : null}
                Add to wedding documents
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
