'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BarChart3, CalendarCheck2, CalendarRange, FolderLock, MessageCircle, PackageOpen, Store, UserRoundCog } from 'lucide-react'
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
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Vendor workspace</p>
            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">Run your Wewed business from one place.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-espresso/60">Manage booking requests, catalogue inventory, deterministic availability, conversations, commercial documents and your public marketplace profile without losing the relationship between the wedding, service and fulfilment record.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/messages" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-gold/30 bg-white px-6 py-3 text-sm font-bold text-espresso shadow-sm transition hover:bg-champagne/40">
                  <MessageCircle className="size-5" />
                  Open Messages
                </Link>
                <Link href="/vendor/bookings" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-espresso px-6 py-3 text-sm font-bold text-champagne shadow-sm transition hover:bg-espresso/90">
                  <CalendarCheck2 className="size-5" />
                  Booking inbox
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Link href="/vendor/bookings" className="group rounded-3xl border-2 border-gold/35 bg-champagne/45 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <CalendarCheck2 className="size-7 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Bookings</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/65">Review requests, quotes, governed commitments and move each booking through preparation, service, return and completion.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-espresso">Open booking inbox <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendor/catalog" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <PackageOpen className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Catalogue</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Publish services, gown variants, sizes, colours, media, rental inventory and real capacity.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Manage catalogue <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendor/availability" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <CalendarRange className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Availability</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Configure booking horizons, weekly hours, blackouts, capacity overrides, service areas, packages and resource-backed add-ons.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Configure supply <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/vendor/analytics" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <BarChart3 className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Booking analytics</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">See booking conversion, confirmed value, catalogue performance and referral-link attribution from canonical booking records.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Open analytics <ArrowRight className="size-4" /></span>
            </Link>

            <Link href="/messages" className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <MessageCircle className="size-6 text-gold-muted" />
              <h2 className="mt-5 font-serif text-3xl">Messages</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">Open your inbox, receive Planner ↔ Vendor enquiries and keep commercial conversations inside Wewed.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted">Open Messages <ArrowRight className="size-4" /></span>
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
