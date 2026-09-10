import { handoffPath } from '@/lib/deep-links'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return handoffPath(path)
  } catch {
    return '/handoff'
  }
}
