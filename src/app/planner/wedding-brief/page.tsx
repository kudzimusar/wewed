import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { WeddingRequirementsEditor } from '@/components/wedding/wedding-requirements-editor'

export default function WeddingBriefPage() {
  return (
    <main className="min-h-screen bg-espresso px-3 pb-24 pt-4 text-champagne sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-champagne/[0.035] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-gold text-espresso"><Sparkles className="size-5" /></div>
            <div>
              <h1 className="wewed-heading text-xl text-champagne">Wedding brief</h1>
              <p className="text-xs text-champagne/50">One shared requirement set for the couple, planner, marketplace and Wewed AI.</p>
            </div>
          </div>
          <Link href="/planner" className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-3 py-2 text-xs text-gold hover:bg-gold/10"><ArrowLeft className="size-3.5" />Planner workspace</Link>
        </header>
        <WeddingRequirementsEditor />
      </div>
    </main>
  )
}
