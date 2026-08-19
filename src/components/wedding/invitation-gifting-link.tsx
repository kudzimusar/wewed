'use client'

import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InvitationGiftingLink({ slug, onNavigate }: { slug: string; onNavigate: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/contribution-campaigns/public?weddingSlug=${encodeURIComponent(slug)}&invitationOnly=1`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((body) => { if (!cancelled) setVisible(Array.isArray(body.data) && body.data.length > 0) })
      .catch(() => { if (!cancelled) setVisible(false) })
    return () => { cancelled = true }
  }, [slug])

  if (!visible) return null

  return (
    <Button asChild type="button" variant="outline" className="border-current/30 bg-transparent">
      <a href="#registry" onClick={onNavigate}><Gift className="mr-2 size-4" />Gifting information</a>
    </Button>
  )
}
