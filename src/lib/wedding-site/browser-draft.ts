/**
 * QRO07-SHIP01 — browser-local UNSAVED drafts for the site editor.
 *
 * The database is authoritative. The browser may only remember text the editor typed but has not
 * yet saved, and only against the exact server version it was typed over. If the server copy has
 * changed since (another device published, a draft was saved elsewhere), the local text is stale
 * and is discarded — it can never override newer server content, and it is never read by the
 * guest-facing site at all.
 */

export interface StoredLocalDraft {
  value: string
  /** updatedAt of the server copy (published row or saved draft) the text was typed over; null = none existed. */
  baseUpdatedAt: string | null
  savedAt: string
}

export function localDraftKey(slug: string, section: string, field: string): string {
  return `wewed:site-editor-draft:v1:${slug}:${section}.${field}`
}

export function parseStoredLocalDraft(raw: string | null): StoredLocalDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLocalDraft>
    if (typeof parsed.value !== 'string' || typeof parsed.savedAt !== 'string') return null
    if (parsed.baseUpdatedAt !== null && typeof parsed.baseUpdatedAt !== 'string') return null
    return { value: parsed.value, baseUpdatedAt: parsed.baseUpdatedAt ?? null, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export type LocalDraftResolution =
  | { use: 'server'; discardLocal: boolean; reason: 'none' | 'stale' | 'same-as-server' }
  | { use: 'local'; value: string }

/**
 * Decide whether an unsaved local draft may be restored into the editor.
 * @param serverValue the current server text for the field (saved draft if any, else published)
 * @param serverUpdatedAt updatedAt of that server text, or null when the field has never been saved
 */
export function resolveLocalDraft(
  stored: StoredLocalDraft | null,
  serverValue: string,
  serverUpdatedAt: string | null,
): LocalDraftResolution {
  if (!stored) return { use: 'server', discardLocal: false, reason: 'none' }
  if (stored.baseUpdatedAt !== serverUpdatedAt) return { use: 'server', discardLocal: true, reason: 'stale' }
  if (stored.value === serverValue) return { use: 'server', discardLocal: true, reason: 'same-as-server' }
  return { use: 'local', value: stored.value }
}
