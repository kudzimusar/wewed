import { useQueryClient } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { WewedApiError, wewedRequest } from '@/lib/api'
import type { MobileSessionPayload } from '@/lib/types'

const SESSION_STORAGE_KEY = 'wewed.native.session.v1'

interface SessionContextValue {
  session: MobileSessionPayload | null
  token: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  switchWedding: (weddingId: string) => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

async function storeToken(token: string) {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  })
}

async function clearToken() {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY)
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<MobileSessionPayload | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const hydrate = useCallback(async (candidate: string) => {
    const payload = await wewedRequest<MobileSessionPayload>('/api/mobile/auth/me', {
      token: candidate,
      method: 'GET',
    })
    const rotatedToken = payload.sessionToken || candidate
    await storeToken(rotatedToken)
    setToken(rotatedToken)
    setSession(payload)
    return payload
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(SESSION_STORAGE_KEY)
        if (!stored || !alive) return
        await hydrate(stored)
      } catch (error) {
        if (error instanceof WewedApiError && error.status === 401) {
          await clearToken().catch(() => undefined)
        }
        if (alive) {
          queryClient.clear()
          setToken(null)
          setSession(null)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [hydrate, queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      queryClient.clear()
      const signInPayload = await wewedRequest<MobileSessionPayload>('/api/mobile/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (!signInPayload.sessionToken) throw new Error('Wewed did not return a secure mobile session.')
      await hydrate(signInPayload.sessionToken)
    } finally {
      setLoading(false)
    }
  }, [hydrate, queryClient])

  const signOut = useCallback(async () => {
    const currentToken = token
    setToken(null)
    setSession(null)
    queryClient.clear()
    await clearToken().catch(() => undefined)
    if (currentToken) {
      await wewedRequest('/api/mobile/auth/signout', {
        method: 'POST',
        token: currentToken,
      }).catch(() => undefined)
    }
  }, [queryClient, token])

  const refreshSession = useCallback(async () => {
    if (!token) return
    try {
      await hydrate(token)
    } catch (error) {
      if (error instanceof WewedApiError && error.status === 401) await signOut()
      else throw error
    }
  }, [hydrate, signOut, token])

  const switchWedding = useCallback(async (weddingId: string) => {
    if (!token) throw new Error('Sign in before switching weddings.')
    if (session?.activeWedding?.id === weddingId) return
    const payload = await wewedRequest<{ success: true; sessionToken: string }>('/api/mobile/auth/wedding', {
      method: 'POST',
      token,
      body: JSON.stringify({ weddingId }),
    })
    queryClient.clear()
    await hydrate(payload.sessionToken)
  }, [hydrate, queryClient, session?.activeWedding?.id, token])

  const value = useMemo<SessionContextValue>(() => ({
    session,
    token,
    loading,
    signIn,
    signOut,
    refreshSession,
    switchWedding,
  }), [loading, refreshSession, session, signIn, signOut, switchWedding, token])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider.')
  return context
}
