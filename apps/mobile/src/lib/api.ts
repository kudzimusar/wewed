import Constants from 'expo-constants'
import { buildWewedHeaders } from '@/lib/api-request'
import type { ApiErrorPayload } from '@/lib/types'

export { appendNativeFile, type NativeUploadFile } from '@/lib/api-request'

const configuredBase = process.env.EXPO_PUBLIC_WEWED_API_BASE_URL
  ?? (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)
  ?? 'https://wewed.pro'

export const API_BASE_URL = configuredBase.replace(/\/$/, '')

export class WewedApiError extends Error {
  status: number
  code?: string
  field?: string

  constructor(message: string, status: number, payload?: ApiErrorPayload | null) {
    super(message)
    this.name = 'WewedApiError'
    this.status = status
    this.code = payload?.code
    this.field = payload?.field
  }
}

interface WewedRequestInit extends Omit<RequestInit, 'headers'> {
  token?: string | null
  headers?: Record<string, string>
}

export async function wewedRequest<T>(path: string, init: WewedRequestInit = {}): Promise<T> {
  const headers = buildWewedHeaders(init)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers,
    })
  } catch (error) {
    throw new WewedApiError(
      error instanceof Error ? error.message : 'Wewed could not reach the network.',
      0,
    )
  }

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => null) as (T & ApiErrorPayload) | null
  if (!response.ok) {
    throw new WewedApiError(
      payload?.error ?? `Wewed request failed (${response.status}).`,
      response.status,
      payload,
    )
  }

  if (payload === null) throw new WewedApiError('Wewed returned an unexpected response.', response.status)
  return payload as T
}
