import { VaultWorkspace } from '@/components/vault/vault-workspace'

interface VaultPageProps {
  searchParams: Promise<{ weddingId?: string }>
}

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const params = await searchParams
  return <VaultWorkspace weddingId={params.weddingId ?? null} />
}

export const metadata = {
  title: 'Wewed Vault | Wewed',
  description: 'Private governed wedding documents, evidence and media references.',
  robots: { index: false, follow: false },
}
