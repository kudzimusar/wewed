'use client'

import type { EditorSiteProjection } from '@/lib/wedding-site/model'

export class EditorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly conflict: boolean,
  ) {
    super(message)
    this.name = 'EditorRequestError'
  }
}

/** Every editor call is wedding-scoped by slug and re-authorized on the server. */
export async function editorRequest<T = unknown>(
  slug: string,
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}${path}`, {
    method: init.method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: string; code?: string }
    | null
  if (!response.ok || !payload?.success) {
    throw new EditorRequestError(
      payload?.error || (response.status === 401 || response.status === 403
        ? 'Your editing session has ended. Sign in again to continue.'
        : 'Something went wrong. Please try again.'),
      response.status,
      response.status === 409 || payload?.code === 'CONFLICT',
    )
  }
  return payload.data as T
}

export function loadEditorProjection(slug: string): Promise<EditorSiteProjection> {
  return editorRequest<EditorSiteProjection>(slug, '/site', { method: 'GET' })
}
