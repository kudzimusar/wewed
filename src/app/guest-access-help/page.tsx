import type { Metadata } from 'next'
import Link from 'next/link'
import { QrCode, ShieldCheck } from 'lucide-react'
import { GuestAccessRecoveryActions } from './recovery-actions'

export const metadata: Metadata = {
  title: 'Wedding Guest Access Help | Wewed',
  description: 'Recover access to a Wewed private wedding invitation or invitation QR code.',
}

type PageProps = {
  searchParams: Promise<{ reason?: string | string[] }>
}

export default async function GuestAccessHelpPage({ searchParams }: PageProps) {
  const params = await searchParams
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason
  const invalidInvitation = reason === 'invalid-invitation'

  return (
    <main className="min-h-screen bg-[#f7f0e5] px-4 py-5 text-[#21180f] sm:py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between px-1 py-2">
          <Link href="/" className="font-serif text-2xl tracking-tight text-[#8b6a3d]" aria-label="Wewed home">
            wewed
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b6a3d]">
            Guest help
          </span>
        </header>

        <section className="mt-4 rounded-[1.5rem] border border-[#8b6a3d]/20 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-[#f3eadb] text-[#8b6a3d]">
            {invalidInvitation ? <QrCode className="size-5" aria-hidden="true" /> : <ShieldCheck className="size-5" aria-hidden="true" />}
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b6a3d]">
            Private invitation access
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-tight sm:text-3xl">
            {invalidInvitation ? 'This invitation link couldn’t be verified' : 'Need help opening your invitation?'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#665b50]">
            {invalidInvitation
              ? 'Open the original invitation again or scan its QR code. Wewed verifies the invitation before showing private wedding details.'
              : 'Use the original invitation link or printed QR so Wewed can securely identify the correct wedding and guest access.'}
          </p>

          <div className="mt-5 rounded-xl bg-[#faf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6a3d]">What to do</p>
            <ol className="mt-3 space-y-3 text-sm leading-5 text-[#554b42]">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#8b6a3d]">1</span>
                <span>If the invitation arrived by message, email or social media, reopen the original message and tap its Wewed invitation link.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#8b6a3d]">2</span>
                <span>If you have a printed invitation, scan its QR code again with your phone camera.</span>
              </li>
            </ol>
          </div>

          <div className="mt-5">
            <GuestAccessRecoveryActions />
          </div>

          <div className="mt-5 flex gap-3 border-t border-[#8b6a3d]/15 pt-4 text-xs leading-5 text-[#786d62]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8b6a3d]" aria-hidden="true" />
            <p>Wewed does not guess or expose another private wedding when an invitation credential cannot be verified.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
