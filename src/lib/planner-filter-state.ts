'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export function usePlannerFilterState<T extends Record<string, string>>(
  storageKey: string,
  defaults: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const defaultValues = useRef(defaults).current
  const [state, setState] = useState<T>(defaultValues)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<T>
        const next = { ...defaultValues }
        for (const key of Object.keys(defaultValues) as Array<keyof T>) {
          if (typeof parsed[key] === 'string') next[key] = parsed[key] as T[keyof T]
        }
        setState(next)
      }
    } catch {
      window.sessionStorage.removeItem(storageKey)
    } finally {
      setReady(true)
    }
  }, [defaultValues, storageKey])

  useEffect(() => {
    if (!ready) return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Session storage is an enhancement; controls still work without it.
    }
  }, [ready, state, storageKey])

  return [state, setState, () => setState(defaultValues)]
}
