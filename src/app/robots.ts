import type { MetadataRoute } from 'next'

const ORIGIN = 'https://wewed.pro'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/couple',
          '/planner',
          '/w/',
          '/vendors/manage',
          '/sign-in',
          '/register',
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  }
}
