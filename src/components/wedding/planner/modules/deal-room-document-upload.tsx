'use client'

import { useState, type FormEvent } from 'react'
import { FileUp, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

const DOCUMENT_ROLES = [
  ['existing_agreement', 'Existing / external contract'],
  ['invoice', 'Invoice'],
  ['receipt', 'Receipt'],
  ['proof', 'Payment / service proof'],
  ['evidence', 'Other evidence'],
] as const

export function DealRoomDocumentUpload({
  engagementId,
  disabled = false,
  onUploaded,
}: {
  engagementId: string
  disabled?: boolean
  onUploaded: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [role, setRole] = useState('existing_agreement')
  const [uploading, setUploading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('dealRoomDocument') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) {
      toast({ title: 'Choose a document first', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.set('file', file)
      body.set('linkRole', role)
      const response = await fetch(`/api/planner/engagements/${engagementId}/evidence`, {
        method: 'POST',
        body,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'The document could not be attached.')
      }
      form.reset()
      setRole('existing_agreement')
      await onUploaded()
      toast({
        title: 'Document attached',
        description: 'One private Vault file now projects to the related service, vendor and Budget records. Financial amounts were not changed.',
      })
    } catch (error) {
      toast({
        title: 'Document attachment failed',
        description: error instanceof Error ? error.message : 'The document could not be attached.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gold/15 bg-gold/[0.025] p-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />
        <div>
          <p className="text-xs font-medium text-champagne">Attach an existing commercial document</p>
          <p className="mt-1 text-[10px] leading-4 text-champagne/45">
            Upload the original softcopy once. Wewed stores it privately in Vault and links the same object to this Service Engagement, its Vendor and linked Budget items. If a contributor has actually paid this vendor directly, the permitted evidence projection is linked to that contribution too. A pledge with $0 paid receives no payment-derived document access.
          </p>
          <p className="mt-1 text-[10px] leading-4 text-champagne/45">
            An uploaded external contract remains an external agreement on record; it is not presented as a Wewed-issued or Wewed-accepted contract.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
        <select
          aria-label="Document type"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={disabled || uploading}
          className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-xs"
        >
          {DOCUMENT_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Input
          name="dealRoomDocument"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={disabled || uploading}
          className="border-gold/20 bg-espresso/70 text-xs file:text-champagne"
        />
        <Button type="submit" size="sm" disabled={disabled || uploading} className="h-10 bg-gold text-espresso hover:bg-gold-light">
          <FileUp className="size-3.5" />{uploading ? 'Attaching…' : 'Attach'}
        </Button>
      </div>
    </form>
  )
}
