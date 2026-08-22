'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, FolderLock, MessageCircle, Store, UserRoundCog } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export default function VendorWorkspacePage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      allowedRoles={['vendor']}
      wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts."
      title="Wewed Vendor Workspace"
      description="Sign in as an approved Vendor owner to manage your Wewed presence and conversations."
      onClose={() => router.push('/vendors')}
    >
      <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Vendor workspace</p>
            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">Your business conversations start here.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-espresso/60">Respond to planners and couples in Messages, review commercial documents for your own Service Engagements, then manage the public profile and marketplace presence for your business.</p>
              </div>
              <Link
                href="/messages"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-espresso px-6 py-3 text-sm font-bold text-champagne shadow-sm transition hover:bg-espresso/90"
              >
                <MessageCircle className="size-5" />
                Open Messages
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Link href="/messages" className="group rounded-3xl border-2 border-gold/35 bg-champagne/45 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <MessageCircle className="size-7 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Messages</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/65">Open your inbox, receive Planner ↔ Vendor enquiries and reply from the same Wewed conversation.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-espresso">Open inbox <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendor/documents" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <FolderLock className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Documents</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Open private contracts, invoices, receipts and evidence only for Service Engagements where you are the recorded provider.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Open documents <ArrowRight className="size-4" /></span>
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
