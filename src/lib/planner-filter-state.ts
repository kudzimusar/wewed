'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function filterParam(key: string): string {
  return `filter_${key}`
}

export function usePlannerFilterState<T extends Record<string, string>>(
  storageKey: string,
  defaults: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultValues = useRef(defaults).current
  const [state, setState] = useState<T>(defaultValues)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const next = { ...defaultValues }
    let saved: Partial<T> = {}
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (raw) saved = JSON.parse(raw) as Partial<T>
    } catch {
      window.sessionStorage.removeItem(storageKey)
    }

    for (const key of Object.keys(defaultValues) as Array<keyof T>) {
      const fromUrl = searchParams.get(filterParam(String(key)))
      if (fromUrl !== null) next[key] = fromUrl as T[keyof T]
      else if (typeof saved[key] === 'string') next[key] = saved[key] as T[keyof T]
    }
    setState(next)
    setReady(true)
  }, [defaultValues, searchParams, storageKey])

  useEffect(() => {
    if (!ready) return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Session storage is an enhancement; controls still work without it.
    }

    if (!pathname.startsWith('/planner/')) return
    const next = new URLSearchParams(searchParams.toString())
    for (const key of Object.keys(defaultValues) as Array<keyof T>) {
      const value = state[key]
      const param = filterParam(String(key))
      if (value === defaultValues[key]) next.delete(param)
      else next.set(param, value)
    }
    const currentQuery = searchParams.toString()
    const nextQuery = next.toString()
    if (nextQuery === currentQuery) return
    const hash = window.location.hash || '#planner-workspace'
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`, { scroll: false })
  }, [defaultValues, pathname, ready, router, searchParams, state, storageKey])

  return [state, setState, () => setState(defaultValues)]
}
