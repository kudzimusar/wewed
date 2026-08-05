import { isIP } from 'node:net'
import { resolve4, resolve6 } from 'node:dns/promises'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createServerClient } from '@/lib/supabase/server'

function privateIp(address: string): boolean {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0
}

async function providerIsAuthorised(email: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ba.id
     FROM public."User" u
     JOIN public."BusinessAccountMember" bam ON bam."userId"=u.id AND bam.status='active'
     JOIN public."BusinessAccount" ba ON ba.id=bam."businessAccountId" AND ba.type IN ('venue','vendor') AND ba.status='active' AND ba."onboardingStatus"='complete'
     WHERE lower(u.email)=lower($1) AND u."isActive"=true LIMIT 1`,
    email,
  )
  return Boolean(rows[0])
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim()
}

function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const patternA = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
    const patternB = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i')
    const match = html.match(patternA) || html.match(patternB)
    if (match?.[1]) return decodeEntities(match[1]).slice(0, 500)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email || !(await providerIsAuthorised(user.email))) {
      return NextResponse.json({ success: false, error: 'An approved provider account is required.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { url?: unknown } | null
    if (!body || typeof body.url !== 'string') return NextResponse.json({ success: false, error: 'Website URL is required.' }, { status: 400 })
    const url = new URL(body.url.trim())
    if (url.protocol !== 'https:') return NextResponse.json({ success: false, error: 'Website must use HTTPS.' }, { status: 400 })
    if (url.username || url.password || url.port) return NextResponse.json({ success: false, error: 'Website URL is not supported.' }, { status: 400 })
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') || isIP(hostname) && privateIp(hostname)) {
      return NextResponse.json({ success: false, error: 'Private network addresses are not supported.' }, { status: 400 })
    }

    const resolved = [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])]
    if (resolved.length === 0 || resolved.some(privateIp)) return NextResponse.json({ success: false, error: 'Website address could not be verified safely.' }, { status: 400 })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'User-Agent': 'WewedProviderProfileBot/1.0', Accept: 'text/html' },
    }).finally(() => clearTimeout(timeout))
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      return NextResponse.json({ success: false, error: 'The website did not return a readable public page.' }, { status: 422 })
    }
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 1_000_000) return NextResponse.json({ success: false, error: 'The website page is too large to inspect.' }, { status: 413 })
    const html = (await response.text()).slice(0, 250_000)
    const title = metaContent(html, ['og:title']) || decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '') || null
    const description = metaContent(html, ['description', 'og:description'])
    const imageUrl = metaContent(html, ['og:image'])
    let safeImageUrl: string | null = null
    if (imageUrl) {
      try {
        const candidate = new URL(imageUrl, url)
        if (candidate.protocol === 'https:') safeImageUrl = candidate.toString()
      } catch { /* ignore invalid metadata */ }
    }

    return NextResponse.json({ success: true, suggestion: { displayName: title?.slice(0, 160) || null, description, coverImageUrl: safeImageUrl } })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Website inspection timed out.' : 'Unable to inspect that website safely.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export const dynamic = 'force-dynamic'
