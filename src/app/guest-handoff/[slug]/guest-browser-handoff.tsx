'use client'

import { useEffect, useState } from 'react'

/**
 * Reads the signed exchange from this page's URL FRAGMENT (never sent to any server), removes it
 * from history at once, and POSTs it to the redeem endpoint. The server answers with the only
 * place this browser may go next — the Couple Website / Registry on success, the wedding's access
 * gateway otherwise — and sets the normal browser Guest session on success.
 */
export function GuestBrowserHandoff({ slug }: { slug: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const gateway = `/w/${encodeURIComponent(slug)}?accessError=handoff`
    const h = new URLSearchParams(window.location.hash.slice(1)).get('h') ?? ''
    window.history.replaceState(null, '', window.location.pathname)
    if (!h) {
      window.location.replace(gateway)
      return
    }
    let cancelled = false
    void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-browser-handoff/redeem`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ h }),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data: { path?: unknown }) => {
        if (cancelled) return
        // Only a same-origin wedding path is followed, whatever the response says.
        const path = typeof data.path === 'string' && data.path.startsWith('/w/') ? data.path : gateway
        window.location.replace(path)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <main data-testid="guest-browser-handoff" className="flex min-h-screen items-center justify-center bg-[#fbf7ef] px-6 text-center text-[#3a2f27]">
      <div>
        <p className="font-serif text-2xl">{failed ? 'We could not open this page' : 'Opening your wedding…'}</p>
        {failed && (
          <p className="mt-3 text-sm text-[#7a6d62]">Check your connection, then return to the Wewed app and try again.</p>
        )}
      </div>
    </main>
  )
}
