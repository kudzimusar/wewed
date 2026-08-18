import { getContractVerification, Phase2ContractError } from '@/lib/contracts/phase2'

export const dynamic = 'force-dynamic'

export default async function ContractVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractNumber: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const [{ contractNumber }, query] = await Promise.all([params, searchParams])
  const requestedVersion = query.v ? Number(query.v) : null
  try {
    const record = await getContractVerification(
      decodeURIComponent(contractNumber),
      requestedVersion && Number.isInteger(requestedVersion) && requestedVersion > 0 ? requestedVersion : null,
    )
    return (
      <main className="grid min-h-screen place-items-center bg-[#211914] px-4 py-8 text-[#f3ead8]">
        <section className="w-full max-w-2xl rounded-2xl border border-[#a8874e]/30 bg-[#2d211b] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5a96e]">WEWED · wewed.pro</p>
          <h1 className="mt-3 font-serif text-2xl sm:text-3xl">Contract version verified</h1>
          <p className="mt-2 text-sm text-[#f3ead8]/60">This page confirms the immutable identifiers Wewed currently records for the issued version. It does not expose private wedding terms or party data.</p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-[#a8874e]/15 p-3"><dt className="text-xs text-[#f3ead8]/45">Contract</dt><dd className="mt-1 font-medium">{record.contractNumber}</dd></div>
            <div className="rounded-xl border border-[#a8874e]/15 p-3"><dt className="text-xs text-[#f3ead8]/45">Version</dt><dd className="mt-1 font-medium">{record.versionNumber} · {record.versionStatus}</dd></div>
            <div className="rounded-xl border border-[#a8874e]/15 p-3"><dt className="text-xs text-[#f3ead8]/45">Issued</dt><dd className="mt-1 font-medium">{new Date(record.issuedAt).toLocaleString()}</dd></div>
            <div className="rounded-xl border border-[#a8874e]/15 p-3"><dt className="text-xs text-[#f3ead8]/45">Template</dt><dd className="mt-1 font-medium">{record.templateCode} · {record.templateVersion}</dd></div>
          </dl>

          <div className="mt-5 space-y-3 break-all rounded-xl border border-[#a8874e]/15 bg-black/10 p-4 font-mono text-[11px] leading-5 text-[#f3ead8]/60">
            <p><span className="font-sans text-[#f3ead8]/40">Canonical SHA-256</span><br />{record.canonicalSha256 || 'Unavailable'}</p>
            <p><span className="font-sans text-[#f3ead8]/40">Artifact SHA-256</span><br />{record.artifactSha256 || 'Unavailable'}</p>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#f3ead8]/45">Template review status: {record.templateReviewStatus.replaceAll('_', ' ')}. Verification confirms Wewed record integrity; it is not a jurisdiction-specific legal enforceability opinion.</p>
        </section>
      </main>
    )
  } catch (error) {
    const message = error instanceof Phase2ContractError ? error.message : 'The Wewed contract record could not be verified.'
    return (
      <main className="grid min-h-screen place-items-center bg-[#211914] px-5 text-[#f3ead8]">
        <section className="w-full max-w-lg rounded-2xl border border-[#a8874e]/25 bg-[#2d211b] p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5a96e]">WEWED · wewed.pro</p>
          <h1 className="mt-3 font-serif text-2xl">Unable to verify</h1>
          <p className="mt-3 text-sm leading-6 text-[#f3ead8]/65">{message}</p>
        </section>
      </main>
    )
  }
}
