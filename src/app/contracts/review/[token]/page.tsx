import { getContractReviewByToken, Phase2ContractError } from '@/lib/contracts/phase2'

export const dynamic = 'force-dynamic'

export default async function ContractReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const review = await getContractReviewByToken(token)
    return (
      <main className="min-h-screen bg-[#211914] px-3 py-5 text-[#f3ead8] sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-4 rounded-2xl border border-[#a8874e]/30 bg-[#2d211b] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5a96e]">Wewed secure review</p>
                <h1 className="mt-1 font-serif text-xl sm:text-2xl">{review.contractNumber}</h1>
                <p className="mt-1 text-xs text-[#f3ead8]/60">Version {review.versionNumber} · Issued {new Date(review.issuedAt).toLocaleString()}</p>
              </div>
              <div className="rounded-full border border-[#a8874e]/30 px-3 py-1 text-xs text-[#c5a96e]">Read only</div>
            </div>
            <div className="mt-4 rounded-xl border border-[#a8874e]/20 bg-[#a8874e]/10 p-3 text-xs leading-5 text-[#f3ead8]/75">
              You are viewing the exact issued version as <strong>{review.viewerRole.replaceAll('_', ' ')}</strong>{review.viewerName ? ` (${review.viewerName})` : ''}. Viewing this page does <strong>not</strong> accept, sign, amend, or make the contract effective. Governed acceptance is a separate Wewed action and is not enabled in this Phase 2 review page.
            </div>
          </header>

          <iframe
            title={`${review.title} ${review.contractNumber}`}
            srcDoc={review.renderedHtml}
            sandbox=""
            className="h-[76vh] min-h-[620px] w-full rounded-2xl border border-[#a8874e]/25 bg-white"
          />

          <footer className="mt-4 break-all rounded-xl border border-[#a8874e]/15 bg-[#2d211b] p-3 text-[11px] leading-5 text-[#f3ead8]/50">
            Canonical SHA-256: {review.contentSha256 || 'Unavailable'}<br />
            Artifact SHA-256: {review.artifactSha256 || 'Unavailable'}<br />
            Template {review.templateVersion} · Review status {review.templateReviewStatus.replaceAll('_', ' ')} · wewed.pro
          </footer>
        </div>
      </main>
    )
  } catch (error) {
    const message = error instanceof Phase2ContractError ? error.message : 'This Wewed review link is unavailable.'
    return (
      <main className="grid min-h-screen place-items-center bg-[#211914] px-5 text-[#f3ead8]">
        <section className="w-full max-w-lg rounded-2xl border border-[#a8874e]/25 bg-[#2d211b] p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5a96e]">Wewed secure review</p>
          <h1 className="mt-3 font-serif text-2xl">Review link unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[#f3ead8]/65">{message}</p>
          <p className="mt-4 text-xs text-[#f3ead8]/45">Ask the wedding planner for a current secure review link.</p>
        </section>
      </main>
    )
  }
}
