'use client'

import Link from 'next/link'
import { LayoutDashboard, LogOut, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { logoutAdmin } from '@/lib/admin-auth'
import { useWewedStore } from '@/lib/store'
import type { PublicWeddingAccessKind } from '@/lib/wedding-access-kind'

/**
 * Compact owner dock for the authenticated couple.
 *
 * The wedding page itself owns authentication entry points. This component
 * intentionally renders nothing for guests, invited guests, planners,
 * vendors and ordinary wedding members. A public wedding page must never
 * advertise a private dashboard/login affordance to guests.
 */
export function CoupleLogin({
  accessKind,
}: {
  accessKind: PublicWeddingAccessKind
}) {
  const editMode = useWewedStore((state) => state.editMode)
  const setEditMode = useWewedStore((state) => state.setEditMode)

  if (accessKind !== 'couple_owner') return null

  function handleLogout() {
    logoutAdmin()
    setEditMode(false)
    toast.info('Signed out. Edit mode disabled.')
    window.location.reload()
  }

  function toggleEditMode() {
    setEditMode(!editMode)
    toast.info(editMode ? 'Edit mode OFF' : 'Edit mode ON', {
      description: editMode
        ? undefined
        : 'Use the gold pencil controls to update your wedding content.',
      duration: 3500,
    })
  }

  return (
    <>
      {editMode && (
        <div className="fixed left-0 right-0 top-16 z-30 bg-gold/90 px-4 py-2 text-center backdrop-blur-sm">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-espresso">
            Edit mode is on — use the gold pencil controls to edit content
          </p>
        </div>
      )}

      <div
        className="fixed bottom-6 left-6 z-40 flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-2"
        data-testid="couple-owner-controls"
      >
        <Link
          href="/couple"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 bg-espresso/95 px-4 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-champagne shadow-lg backdrop-blur-md transition hover:border-gold hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label="Couple dashboard"
        >
          <LayoutDashboard className="h-4 w-4 text-gold" />
          Couple dashboard
        </Link>

        <Button
          onClick={toggleEditMode}
          className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md transition-all ${
            editMode
              ? 'border-gold bg-gold text-espresso hover:bg-gold/90'
              : 'border-gold/40 bg-espresso/95 text-champagne hover:border-gold hover:bg-espresso'
          }`}
          aria-label={editMode ? 'Turn off edit mode' : 'Turn on edit mode'}
        >
          <Pencil className={`h-4 w-4 ${editMode ? 'text-espresso' : 'text-gold'}`} />
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]">
            {editMode ? 'Editing' : 'Edit'}
          </span>
        </Button>

        <Button
          onClick={handleLogout}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/95 px-3 py-2.5 text-champagne shadow-lg backdrop-blur-md transition-all hover:border-clay hover:bg-espresso hover:text-clay"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4 text-gold/70" />
        </Button>
      </div>
    </>
  )
}
