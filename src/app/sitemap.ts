import type { MetadataRoute } from 'next'
import { getPublicDocuments, type PublicDocumentCategory } from '@/lib/public-site-documents'

const ORIGIN = 'https://wewed.pro'

const CATEGORY_PATH: Record<PublicDocumentCategory, string> = {
  company: '/company',
  trust: '/trust',
  legal: '/legal',
  vendors: '/vendors/resources',
  developers: '/developers',
  help: '/help',
}

const CORE_PUBLIC_PATHS = [
  '/',
  '/planners',
  '/vendors',
  '/for-planners',
  '/how-it-works',
  '/pricing',
  '/guest-access-help',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = new Set<string>(CORE_PUBLIC_PATHS)

  for (const category of Object.keys(CATEGORY_PATH) as PublicDocumentCategory[]) {
    const base = CATEGORY_PATH[category]
    paths.add(base)
    for (const document of getPublicDocuments(category)) {
      paths.add(`${base}/${document.slug}`)
    }
  }

  return [...paths].map((path) => ({
    url: `${ORIGIN}${path === '/' ? '' : path}`,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path.split('/').filter(Boolean).length === 1 ? 0.8 : 0.6,
  }))
}
