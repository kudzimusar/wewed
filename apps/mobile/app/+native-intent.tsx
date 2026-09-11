import { nativeIntentPath } from '@/lib/deep-links'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return nativeIntentPath(path)
  } catch {
    // A malformed or unexpected external intent must never crash native startup
    // or fabricate a secure continuation target. Fall back to the normal root.
    return '/'
  }
}
