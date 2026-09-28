/**
 * The repository's own local CI browser gate: `next start` against a disposable localhost database
 * with WEWED_E2E_MODE=1 on a CI runner, never on Vercel. Only surfaces that exist to be visually
 * qualified (e.g. the Ivory UAT/preview pages) may use this to render in a production build;
 * every real deployment — Vercel production AND preview — still treats them as not found.
 */
export function isLocalCiBrowserMode(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
  return process.env.WEWED_E2E_MODE === '1' && process.env.CI === 'true' && !process.env.VERCEL && localDatabase
}
