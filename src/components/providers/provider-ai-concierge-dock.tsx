import { ProviderAiConcierge } from './provider-ai-concierge'

export function ProviderAiConciergeDock({
  providerSlug,
  providerName,
}: {
  providerSlug: string
  providerName: string
}) {
  return (
    <div className="fixed bottom-24 left-4 z-50 rounded-2xl bg-[#211a15] p-1 shadow-xl shadow-black/20 sm:bottom-6 sm:left-6">
      <ProviderAiConcierge providerSlug={providerSlug} providerName={providerName} />
    </div>
  )
}
