'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function BookingUxRouteClass() {
  const pathname = usePathname()

  useEffect(() => {
    const body = document.body
    let value = ''

    if (pathname === '/planner/bookings') value = 'planner'
    else if (pathname === '/vendor/bookings') value = 'vendor'
    else if (/^\/vendors\/[^/]+(?:\/book\/[^/]+)?$/.test(pathname)) value = 'provider'

    if (value) body.dataset.bookingUx = value
    else delete body.dataset.bookingUx

    return () => {
      if (body.dataset.bookingUx === value) delete body.dataset.bookingUx
    }
  }, [pathname])

  return null
}
