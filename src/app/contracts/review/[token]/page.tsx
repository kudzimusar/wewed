import { ContractDecisionPanel } from '@/components/contracts/contract-decision-panel'
import { getPhase3ContractReviewByToken, Phase3ContractError } from '@/lib/contracts/phase3'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Secure Contract Review | Wewed',
  robots: { index: false, follow: false },
}

export default async function ContractReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const review = await getPhase3ContractReviewByToken(token)
    return (
      <main className="min-h-screen bg-[#211914] px-4 py-8 text-[#f3ead8] sm:px-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="rounded-2xl border border-[#a8874e]/25 bg-[#2d211b] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5a96e]">Wewed secure review · wewed.pro</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-3xl">{review.title}</h1>
                <p className="mt-1 text-sm text-[#f3ead8]/60">{review.contractNumber} · Version {review.versionNumber} · {review.versionStatus.replaceAll('_', ' ')}</p>
              </div>
              <div className="rounded-xl border border-[#a8874e]/20 bg-black/15 px-4 py-3 text-right text-xs">
                <p className="text-[#f3ead8]/55">Reviewing as</p>
                <p className="mt-1 font-semibold text-[#c5a96e]">{review.viewerName || review.viewerRole}</p>
              </div>
            </div>
            {review.amendment ? (
              <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-100/10 p-4 text-sm">
                <strong>Governed amendment proposal.</strong> The previously effective version remains effective until every required party accepts this exact replacement version.
              </div>
            ) : null}
            <div className="mt-5 rounded-xl border border-[#a8874e]/20 bg-[#fff7e6]/5 p-4 text-sm leading-6 text-[#f3ead8]/75">
              <strong>Viewing is not acceptance.</strong> Wewed records acceptance only after an explicit party decision against the exact fingerprints below. Payment, message delivery, or opening this page cannot make the contract effective.
            </div>
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/15 p-3"><span className="text-[#f3ead8]/45">Canonical SHA-256</span><p className="mt-1 break-all font-mono">{review.contentSha256 || 'Unavailable'}</p></div>
              <div className="rounded-xl border border-white/10 bg-black/15 p-3"><span className="text-[#f3ead8]/45">Issued artifact SHA-256</span><p className="mt-1 break-all font-mono">{review.artifactSha256 || 'Unavailable'}</p></div>
            </div>
          </header>

          <section className="overflow-hidden rounded-2xl border border-[#a8874e]/25 bg-white">
            <iframe title={`Wewed contract ${review.contractNumber} version ${review.versionNumber}`} className="h-[70vh] min-h-[560px] w-full bg-white" sandbox="" srcDoc={review.renderedHtml} />
          </section>

          <ContractDecisionPanel
            token={token}
            viewerName={review.viewerName || ''}
            emailRequired={review.viewerEmailRequired}
            canDecide={review.canAccept}
            currentDecision={review.decision}
            decisionAt={review.decisionAt}
            declaration={review.declaration}
          />
        </div>
      </main>
    )
  } catch (error) {
    const message = error instanceof Phase3ContractError ? error.message : 'Review link could not be verified.'
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
