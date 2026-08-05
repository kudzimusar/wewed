'use client'

import { useEffect } from 'react'
import { PublicPlatformHomeV2 } from '@/components/public/public-platform-home-v2'

const ROLE_MEDIA: Record<string, { src: string; alt: string }> = {
  'For couples': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/13b43ea7-212d-4783-b453-9cc7daa68403.jpg',
    alt: 'Black bride and groom sharing a joyful garden wedding moment',
  },
  'For planners': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/6e4b77ef-418d-49b1-b0af-4743277ec162.jpg',
    alt: 'Wedding planners collaborating over a detailed event plan',
  },
  'For guests': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/c9a726f0-b398-4e38-a5f0-0a16f6ac3c6f.jpg',
    alt: 'Wedding guests celebrating together under warm reception lights',
  },
}

const INSPIRATION_MEDIA: Record<string, { src: string; alt: string }> = {
  'A beautiful beginning': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/c93eb123-69b8-4bdf-84b4-8d14f9947d3f.jpg',
    alt: 'Black bride and groom walking together beneath a floral garden arch',
  },
  'Champagne and candlelight': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/c759a3dc-c6c8-46c7-b8fc-3b13303fcd92.jpg',
    alt: 'Elegant candlelit wedding reception tables with flowers and glassware',
  },
  'The joy after “I do”': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/5ea6f013-d342-46a4-9fea-75407cc7a346.jpg',
    alt: 'Black newlyweds dancing joyfully with family and friends',
  },
  'A day to remember': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/9b552a89-a803-460a-abb0-969b5d982ef5.jpg',
    alt: 'Wedding photographer capturing a Black couple in a garden at golden hour',
  },
}

const VENDOR_MEDIA: Record<string, { src: string; alt: string }> = {
  Venues: {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/43c494f8-d00d-43a6-9fd4-27d82c53bdd0.jpg',
    alt: 'Elegant outdoor wedding venue with a floral aisle and ceremony seating',
  },
  Photographers: {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/78ba56f7-2ead-42d3-b9db-8806417955d8.jpg',
    alt: 'Professional Black wedding photographer working with a camera',
  },
  Florists: {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/5c7215b5-6fa5-4b1b-a0a2-33a52683ea24.jpg',
    alt: 'Wedding florist arranging fresh pink and white flowers',
  },
  Caterers: {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/258590ae-cd38-483d-874d-0a94da224a1c.jpg',
    alt: 'Refined plated wedding meal prepared for reception service',
  },
  Entertainment: {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/0b054b43-b755-453d-ba51-b79a058d95c6.jpg',
    alt: 'Live wedding band performing under colourful stage lights',
  },
  'Décor & rentals': {
    src: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/73ba4380-98f6-401e-99e5-5fcfe8e84a55.jpg',
    alt: 'Styled wedding reception with elegant tables, florals and hanging lights',
  },
}

function applyImage(card: Element, media: { src: string; alt: string } | undefined) {
  if (!media) return
  const image = card.querySelector('img')
  if (!(image instanceof HTMLImageElement)) return
  if (image.getAttribute('src') !== media.src) image.setAttribute('src', media.src)
  if (image.getAttribute('alt') !== media.alt) image.setAttribute('alt', media.alt)
  image.setAttribute('decoding', 'async')
}

function applyHomepageMedia() {
  document.querySelectorAll('#couples a').forEach((card) => {
    const label = card.querySelector('p')?.textContent?.trim() ?? ''
    applyImage(card, ROLE_MEDIA[label])
  })

  document.querySelectorAll('[data-testid="wedding-inspiration-carousel"] article').forEach((card) => {
    const title = card.querySelector('h3')?.textContent?.trim() ?? ''
    applyImage(card, INSPIRATION_MEDIA[title])
  })

  document.querySelectorAll('#vendors a').forEach((card) => {
    const title = card.querySelector('h3')?.textContent?.trim() ?? ''
    applyImage(card, VENDOR_MEDIA[title])
  })
}

export function PublicPlatformHomeV3() {
  useEffect(() => {
    applyHomepageMedia()
    const observer = new MutationObserver(() => applyHomepageMedia())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return <PublicPlatformHomeV2 />
}
