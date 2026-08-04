import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  publicVendorDescription,
  resolveTimelineFields,
} from '@/lib/planner-legacy-metadata'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
} from '@/lib/wedding-public-access'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')?.trim() || 'charity-and-kudzie'
    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed) {
      return noStore(
        NextResponse.json(weddingAccessErrorPayload(access), { status: access.status }),
      )
    }

    const wedding = await db.wedding.findUnique({
      where: { slug },
      include: {
        couple: { include: { kids: true } },
        programmeItems: { orderBy: { order: 'asc' } },
        songs: { orderBy: [{ order: 'asc' }, { votes: 'desc' }] },
        guests: {
          where: { role: { in: ['bridal_party', 'family'] } },
          orderBy: [{ side: 'asc' }, { roleDetail: 'asc' }],
        },
        vendors: { orderBy: { featured: 'desc' } },
        messages: {
          where: { isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!wedding) {
      return noStore(
        NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 }),
      )
    }

    return noStore(
      NextResponse.json({
        success: true,
        data: {
          id: wedding.id,
          slug: wedding.slug,
          title: wedding.title,
          monogram: wedding.monogram,
          tagline: wedding.tagline,
          date: wedding.date,
          venue: wedding.venue,
          venueCity: wedding.venueCity,
          venueCountry: wedding.venueCountry,
          venueMapUrl: wedding.venueMapUrl,
          lifecycle: wedding.lifecycle,
          theme: {
            primaryColor: wedding.primaryColor,
            accentColor: wedding.accentColor,
            memoryColor: wedding.memoryColor,
            backgroundColor: wedding.backgroundColor,
          },
          couple: {
            partner1: wedding.couple.partner1,
            partner2: wedding.couple.partner2,
            surname: wedding.couple.surname,
            photo: wedding.couple.photo,
            kids: wedding.couple.kids.map((kid) => ({
              name: kid.name,
              gender: kid.gender,
            })),
          },
          programme: wedding.programmeItems.map((item) => {
            const metadata = resolveTimelineFields(item)
            return {
              id: item.id,
              time: item.time,
              title: item.title,
              description: item.description,
              icon: metadata.icon,
              duration: metadata.duration,
              location: metadata.location,
              order: item.order,
            }
          }),
          songs: wedding.songs.map((song) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            phase: song.phase,
            moment: song.moment,
            votes: song.votes,
            order: song.order,
          })),
          bridalParty: wedding.guests.map((guest) => ({
            id: guest.id,
            name: guest.name,
            role: guest.role,
            roleDetail: guest.roleDetail,
            side: guest.side,
          })),
          vendors: wedding.vendors.map((vendor) => ({
            id: vendor.id,
            name: vendor.name,
            category: vendor.category,
            description: publicVendorDescription(vendor.description),
            website: vendor.website,
            featured: vendor.featured,
          })),
          messages: wedding.messages.map((message) => ({
            id: message.id,
            type: message.type,
            content: message.content,
            authorName: message.authorName,
            createdAt: message.createdAt,
          })),
        },
      }),
    )
  } catch (error) {
    console.error('[WEDDING GET] Error:', error)
    return noStore(
      NextResponse.json(
        { success: false, error: 'Failed to fetch wedding data.' },
        { status: 500 },
      ),
    )
  }
}

export const dynamic = 'force-dynamic'
