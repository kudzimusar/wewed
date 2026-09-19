'use client'

import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'

export function GuestAccessRecoveryActions() {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.assign('/')
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <button
        type="button"
        onClick={goBack}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#21180f] px-4 py-3 text-sm font-semibold text-white"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Go back to invitation
      </button>
      <Link
        href="/"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8b6a3d]/30 bg-white px-4 py-3 text-sm font-semibold text-[#21180f]"
      >
        <Home className="size-4" aria-hidden="true" />
        Wewed home
      </Link>
    </div>
  )
}
