'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, MessageCircle, Store, UserRoundCog } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export default function VendorWorkspacePage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      allowedRoles={['vendor']}
      wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts."
      title="Wewed Vendor Workspace"
      description="Sign in as an approved Vendor owner to manage your Wewed presence and conversations."
      onClose={() => router.push('/')}
    >
      <main className="min-h-dvh bg-ivory px-4 py-12 text-espresso sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Vendor workspace</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-tight sm:text-6xl">Your business conversations start here.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-espresso/60">Wewed keeps the initial Vendor workspace intentionally focused: respond to planners and couples in Messages, review the public marketplace profile, and use the governed profile-management flow for business updates.</p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Link href="/messages" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <MessageCircle className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Messages</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Receive and reply to approved in-app conversations, including Planner ↔ Vendor enquiries.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Open inbox <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendors" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Store className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Marketplace</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">See the public Vendor directory exactly as couples and planners see it.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Browse vendors <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendors/manage" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <UserRoundCog className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Profile</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Use Wewed&apos;s governed profile workflow when business information, services or media need updating.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Manage profile <ArrowRight className="size-4" /></span>
            </Link>
          </div>
        </div>
      </main>
    </DashboardAuthGate>
  )
}
