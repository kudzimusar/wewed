'use client'

import { useEffect } from 'react'
import { useWewedStore } from '@/lib/store'

/**
 * Manually rehydrates the zustand persist store on the client.
 * This prevents hydration mismatches because the server always
 * renders with default state, and the client only applies persisted
 * state after mount.
 */
export function StoreRehydrator() {
  useEffect(() => {
    useWewedStore.persist.rehydrate()
  }, [])
  return null
}
