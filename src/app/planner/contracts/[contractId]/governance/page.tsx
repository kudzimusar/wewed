import { PlannerContractGovernance } from '@/components/contracts/planner-contract-governance'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Contract Acceptance & Amendments | Wewed Planner',
  robots: { index: false, follow: false },
}

export default async function PlannerContractGovernancePage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  return (
    <main className="min-h-screen bg-ivory px-4 py-8 text-espresso sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <a href="/planner" className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">← Planner workspace</a>
        <div className="mt-4"><PlannerContractGovernance contractId={contractId} /></div>
      </div>
    </main>
  )
}
