import { expect, test } from 'bun:test'
import { validateQualificationOrigin } from '@/lib/parity/qualification-origin'

// Same cases as apps/ios ProductionPreviewLaneTests and apps/android ProductionPreviewLaneTest.
test('tooling uses the exact native qualification origin allowlist', () => {
  const accepted: Record<string, string> = {
    'https://wewed-git-integration-phase13-live-11-11.vercel.app': 'https://wewed-git-integration-phase13-live-11-11.vercel.app',
    'https://wewed-6tu6k3pyc-11-11.vercel.app/': 'https://wewed-6tu6k3pyc-11-11.vercel.app',
    'HTTPS://WEWED-6TU6K3PYC-11-11.VERCEL.APP': 'https://wewed-6tu6k3pyc-11-11.vercel.app',
    'http://127.0.0.1:3000': 'http://127.0.0.1:3000',
    'http://localhost:3000': 'http://localhost:3000',
  }
  for (const [raw, origin] of Object.entries(accepted)) expect(validateQualificationOrigin(raw)).toEqual({ ok: true, origin })
  const rejected: Array<[string | null, string]> = [
    [null, 'missing'], ['   ', 'missing'], ['not a url', 'malformed'],
    ['https://evil.example', 'hostNotAllowlisted'], ['https://wewed-x-11-11.vercel.app.evil.example', 'hostNotAllowlisted'],
    ['https://other-x-11-11.vercel.app', 'hostNotAllowlisted'], ['https://wewed-x-22-22.vercel.app', 'hostNotAllowlisted'],
    ['https://wewed-x-11-11.vercel.app:8443', 'hostNotAllowlisted'], ['http://wewed-x-11-11.vercel.app', 'insecureScheme'],
    ['ftp://127.0.0.1', 'insecureScheme'], ['https://wewed.pro', 'productionHost'], ['https://www.wewed.pro', 'productionHost'],
    ['https://api.wewed.pro', 'productionHost'], ['https://user:pw@wewed-x-11-11.vercel.app', 'unexpectedComponents'],
    ['https://wewed-x-11-11.vercel.app/api', 'unexpectedComponents'], ['https://wewed-x-11-11.vercel.app?x=1', 'unexpectedComponents'],
  ]
  for (const [raw, reason] of rejected) expect(validateQualificationOrigin(raw)).toEqual({ ok: false, reason } as never)
})
