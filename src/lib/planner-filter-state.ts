'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useRouter } from 'next/navigation'

function filterParam(key: string): string {
  return `filter_${key}`
}

export function usePlannerFilterState<T extends Record<string, string>>(
  storageKey: string,
  defaults: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const router = useRouter()
  const defaultValues = useRef(defaults).current
  const [state, setState] = useState<T>(defaultValues)
  const [ready, setReady] = useState(false)

  const hydrateFromLocation = useCallback(() => {
    const next = { ...defaultValues }
    let saved: Partial<T> = {}
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (raw) saved = JSON.parse(raw) as Partial<T>
    } catch {
      window.sessionStorage.removeItem(storageKey)
    }

    const current = new URLSearchParams(window.location.search)
    for (const key of Object.keys(defaultValues) as Array<keyof T>) {
      const fromUrl = current.get(filterParam(String(key)))
      if (fromUrl !== null) next[key] = fromUrl as T[keyof T]
      else if (typeof saved[key] === 'string') next[key] = saved[key] as T[keyof T]
    }
    setState(next)
    setReady(true)
  }, [defaultValues, storageKey])

  useEffect(() => {
    hydrateFromLocation()
    window.addEventListener('popstate', hydrateFromLocation)
    return () => window.removeEventListener('popstate', hydrateFromLocation)
  }, [hydrateFromLocation])

  useEffect(() => {
    if (!ready) return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Session storage is an enhancement; controls still work without it.
    }

    const livePathname = window.location.pathname
    if (!livePathname.startsWith('/planner/')) return
    const current = new URLSearchParams(window.location.search)
    const next = new URLSearchParams(current)
    for (const key of Object.keys(defaultValues) as Array<keyof T>) {
      const value = state[key]
      const param = filterParam(String(key))
      if (value === defaultValues[key]) next.delete(param)
      else next.set(param, value)
    }
    const currentQuery = current.toString()
    const nextQuery = next.toString()
    if (nextQuery === currentQuery) return
    const hash = window.location.hash || '#planner-workspace'
    router.replace(`${livePathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`, { scroll: false })
  }, [defaultValues, ready, router, state, storageKey])

  return [state, setState, () => setState(defaultValues)]
}
