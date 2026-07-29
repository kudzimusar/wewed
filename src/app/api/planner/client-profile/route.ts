import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildMapsSearchUrl,
  cleanOptionalText,
  cleanStringList,
  cleanText,
  cleanUrl,
  clientProfileCompleteness,
} from '@/lib/planner-phase5'
import { requireWeddingPermission } from '@/lib/wedding-access'

const VENUE_FIELDS = [
  'heading',
  'subtitle',
  'description',
  'address',
  'suburb',
  'cityCountry',
  'phone',
  'website',
  'imageUrl',
  'imageAlt',
  'imageCaption',
  'imageTitle',
  'aboutEyebrow',
  'aboutHeading',
  'exploreLabel',
  'directionsLabel',
] as const

type VenueField = (typeof VENUE_FIELDS)[number]

function contentValue(
  content: Map<string, { value: string; order: number; metadata: string | null }>,
  field: string,
): string {
  return content.get(field)?.value ?? ''
}

async function loadProfile(weddingId: string) {
  const wedding = await db.wedding.findUnique({
    where: { id: weddingId },
    include: {
      couple: {
        select: {
          id: true,
          partner1: true,
          partner2: true,
          surname: true,
        },
      },
      contentItems: {
        where: { section: 'venue' },
        orderBy: [{ order: 'asc' }, { field: 'asc' }],
      },
    },
  })

  if (!wedding) return null

  const content = new Map(
    wedding.contentItems.map((item) => [
      item.field,
      { value: item.value, order: item.order, metadata: item.metadata },
    ]),
  )
  const venue = Object.fromEntries(
    VENUE_FIELDS.map((field) => [field, contentValue(content, field)]),
  ) as Record<VenueField, string>
  const features = wedding.contentItems
    .filter((item) => /^feature-\d+$/.test(item.field))
    .map((item) => item.value)
  const moments = wedding.contentItems
    .filter((item) => /^moment-\d+$/.test(item.field))
    .map((item) => item.value)

  const profile = {
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      monogram: wedding.monogram ?? '',
      tagline: wedding.tagline ?? '',
      date: wedding.date.toISOString(),
      venue: wedding.venue,
      venueCity: wedding.venueCity,
      venueCountry: wedding.venueCountry,
      venueMapUrl: wedding.venueMapUrl ?? '',
      lifecycle: wedding.lifecycle,
      privacy: wedding.privacy,
    },
    couple: wedding.couple,
    venue: {
      ...venue,
      features,
      moments,
    },
  }

  return {
    ...profile,
    completeness: clientProfileCompleteness({
      partner1: profile.couple.partner1,
      partner2: profile.couple.partner2,
      title: profile.wedding.title,
      date: profile.wedding.date,
      venue: profile.wedding.venue,
      venueCity: profile.wedding.venueCity,
      venueCountry: profile.wedding.venueCountry,
      venueMapUrl: profile.wedding.venueMapUrl,
      venueAddress: profile.venue.address,
      venuePhone: profile.venue.phone,
      venueDescription: profile.venue.description,
    }),
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const profile = await loadProfile(access.context.weddingId)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'The active wedding could not be found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error('[planner client profile GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load the client profile.' },
      { status: 500 },
    )
  }
}

interface ProfilePayload {
  wedding?: {
    title?: unknown
    monogram?: unknown
    tagline?: unknown
    date?: unknown
    venue?: unknown
    venueCity?: unknown
    venueCountry?: unknown
    venueMapUrl?: unknown
  }
  couple?: {
    partner1?: unknown
    partner2?: unknown
    surname?: unknown
  }
  venue?: Partial<Record<VenueField, unknown>> & {
    features?: unknown
    moments?: unknown
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json().catch(() => null)) as ProfilePayload | null
    if (!body?.wedding || !body.couple || !body.venue) {
      return NextResponse.json(
        { success: false, error: 'Wedding, couple, and venue data are required.' },
        { status: 400 },
      )
    }

    const title = cleanText(body.wedding.title, 160)
    const partner1 = cleanText(body.couple.partner1, 100)
    const partner2 = cleanText(body.couple.partner2, 100)
    const venueName = cleanText(body.wedding.venue, 180)
    const venueCity = cleanText(body.wedding.venueCity, 120)
    const venueCountry = cleanText(body.wedding.venueCountry, 120)
    if (!title || !partner1 || !partner2 || !venueName || !venueCity || !venueCountry) {
      return NextResponse.json(
        {
          success: false,
          error: 'Couple names, wedding title, venue name, city, and country are required.',
        },
        { status: 400 },
      )
    }

    const date = new Date(cleanText(body.wedding.date, 80))
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { success: false, error: 'A valid wedding date and time are required.' },
        { status: 400 },
      )
    }

    const venueAddress = cleanText(body.venue.address, 300)
    const submittedMapUrl = cleanText(body.wedding.venueMapUrl, 2000)
    const venueMapUrl = submittedMapUrl
      ? cleanUrl(submittedMapUrl, { allowHttp: true })
      : buildMapsSearchUrl([
          venueName,
          venueAddress,
          cleanText(body.venue.suburb, 120),
          venueCity,
          venueCountry,
        ])
    if (submittedMapUrl && !venueMapUrl) {
      return NextResponse.json(
        { success: false, error: 'Venue directions must use a valid HTTP or HTTPS URL.' },
        { status: 400 },
      )
    }

    const venueValues: Record<VenueField, string> = {
      heading: cleanText(body.venue.heading, 180) || venueName,
      subtitle: cleanText(body.venue.subtitle, 300),
      description: cleanText(body.venue.description),
      address: venueAddress,
      suburb: cleanText(body.venue.suburb, 120),
      cityCountry:
        cleanText(body.venue.cityCountry, 220) || `${venueCity}, ${venueCountry}`,
      phone: cleanText(body.venue.phone, 80),
      website: cleanUrl(body.venue.website, { allowHttp: true }) ?? '',
      imageUrl: cleanUrl(body.venue.imageUrl, { allowRelative: true }) ?? '',
      imageAlt: cleanText(body.venue.imageAlt, 300),
      imageCaption: cleanText(body.venue.imageCaption, 220),
      imageTitle: cleanText(body.venue.imageTitle, 220),
      aboutEyebrow: cleanText(body.venue.aboutEyebrow, 120) || 'About the Venue',
      aboutHeading: cleanText(body.venue.aboutHeading, 260),
      exploreLabel: cleanText(body.venue.exploreLabel, 100) || 'Explore Venue',
      directionsLabel: cleanText(body.venue.directionsLabel, 100) || 'Get Directions',
    }
    const features = cleanStringList(body.venue.features)
    const moments = cleanStringList(body.venue.moments, 8)

    await db.$transaction(async (tx) => {
      const current = await tx.wedding.findUnique({
        where: { id: access.context.weddingId },
        select: { coupleId: true },
      })
      if (!current) throw new Error('Active wedding not found.')

      await tx.wedding.update({
        where: { id: access.context.weddingId },
        data: {
          title,
          monogram: cleanOptionalText(body.wedding.monogram, 80),
          tagline: cleanOptionalText(body.wedding.tagline, 300),
          date,
          venue: venueName,
          venueCity,
          venueCountry,
          venueMapUrl,
        },
      })
      await tx.couple.update({
        where: { id: current.coupleId },
        data: {
          partner1,
          partner2,
          surname: cleanOptionalText(body.couple.surname, 120),
        },
      })

      for (const field of VENUE_FIELDS) {
        await tx.weddingContent.upsert({
          where: {
            weddingId_section_field: {
              weddingId: access.context.weddingId,
              section: 'venue',
              field,
            },
          },
          update: { value: venueValues[field] },
          create: {
            weddingId: access.context.weddingId,
            section: 'venue',
            field,
            value: venueValues[field],
            order: 0,
          },
        })
      }

      if (Array.isArray(body.venue.features)) {
        await tx.weddingContent.deleteMany({
          where: {
            weddingId: access.context.weddingId,
            section: 'venue',
            field: { startsWith: 'feature-' },
          },
        })
        if (features.length) {
          await tx.weddingContent.createMany({
            data: features.map((value, index) => ({
              weddingId: access.context.weddingId,
              section: 'venue',
              field: `feature-${index}`,
              value,
              order: index,
            })),
          })
        }
      }

      if (Array.isArray(body.venue.moments)) {
        await tx.weddingContent.deleteMany({
          where: {
            weddingId: access.context.weddingId,
            section: 'venue',
            field: { startsWith: 'moment-' },
          },
        })
        if (moments.length) {
          await tx.weddingContent.createMany({
            data: moments.map((value, index) => ({
              weddingId: access.context.weddingId,
              section: 'venue',
              field: `moment-${index}`,
              value,
              order: 100 + index,
            })),
          })
        }
      }

      await tx.auditEvent.create({
        data: {
          action: 'client_profile.update',
          resourceType: 'wedding',
          resourceId: access.context.weddingId,
          afterValue: JSON.stringify({
            title,
            partner1,
            partner2,
            venue: venueName,
            venueAddress,
            venueCity,
            venueCountry,
            venueMapUrl,
          }),
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
        },
      })
    })

    const profile = await loadProfile(access.context.weddingId)
    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error('[planner client profile PATCH] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to save the client profile.' },
      { status: 500 },
    )
  }
}
