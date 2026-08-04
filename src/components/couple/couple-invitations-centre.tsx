'use client'

import Link from 'next/link'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { InvitationManager } from '@/components/wedding/invitation-manager'

export function CoupleInvitationsCentre() {
  return (
    <DashboardAuthGate
      allowedRoles={['couple']}
      wrongRoleMessage="Sign in with the couple account that owns this wedding."
      title="Guests and invitations"
      description="Prepare private guest invitation links and QR codes."
      onClose={() => { window.location.href = '/couple' }}
    >
      <main className="min-h-screen bg-ivory text-espresso">
        <header className="border-b border-gold/20 bg-espresso px-4 py-8 text-champagne sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Guests & invitations</p><h1 className="mt-2 font-serif text-4xl">Private invitation access</h1><p className="mt-2 max-w-2xl text-sm text-champagne/60">Generate, copy, export and rotate guest-specific QR credentials from one protected screen.</p></div><div className="flex gap-2"><Link href="/couple" className="rounded-full border border-gold/30 px-4 py-2 text-xs text-gold hover:bg-gold/10">Couple dashboard</Link><Link href="/planner/guests" className="rounded-full border border-gold/30 px-4 py-2 text-xs text-champagne/70 hover:bg-gold/10">Guest records</Link></div></div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><InvitationManager /></div>
      </main>
    </DashboardAuthGate>
  )
}
