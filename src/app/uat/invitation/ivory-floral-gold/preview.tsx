'use client'

import { useState } from 'react'
import { IvoryFloralGoldTriFold } from '@/components/wedding/invitation-experience/ivory-floral-gold-trifold'

const CHARITY_KUDZIE_UAT_DATA = {
  title: 'Charity Manyewu & Shadreck Kudzanai Musarurwa',
  monogram: 'C · S',
  tagline: 'Your presence will make our day complete.',
  date: '2026-12-23T00:00:00.000Z',
  venue: 'Imba Manor',
  venueAddress: '1 Worplestone Way',
  venueCity: 'Glen Lorne, Harare',
  venueCountry: 'Zimbabwe',
  venueMapUrl: 'https://www.google.com/maps/search/?api=1&query=Imba%20Manor%2C%201%20Worplestone%20Way%2C%20Glen%20Lorne%2C%20Harare%2C%20Zimbabwe',
  guestName: null,
  message: 'Request the pleasure of your company as we celebrate our marriage.',
  rsvpDeadline: null,
  primaryColor: '#b3833f',
  accentColor: '#d6b77c',
  backgroundColor: '#fbf5e9',
} as const

export function IvoryFloralGoldUatPreview() {
  const [open, setOpen] = useState(false)

  return (
    <main
      data-testid="ivory-uat-preview"
      className="flex min-h-svh w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_24%,#fffaf1_0%,#eee2d0_52%,#d9c6ab_100%)] py-3"
    >
      <IvoryFloralGoldTriFold
        data={CHARITY_KUDZIE_UAT_DATA}
        open={open}
        reducedMotion={false}
        onOpen={() => setOpen(true)}
        previewMode
      />
    </main>
  )
}
