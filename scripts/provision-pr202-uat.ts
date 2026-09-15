/** Explicit, preview-build-only provisioning. Never part of the normal build. */
import { PrismaClient } from '@prisma/client'
import { createHmac } from 'node:crypto'

const branch = 'feature/private-invitation-android-delivery-20260912'
const weddingId = 'wewed-pr202-uat-20260912'
const slug = weddingId

if (
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== branch ||
  process.env.WEWED_UAT_PROVISION !== weddingId
) {
  throw new Error('Provisioning requires the exact PR #202 preview and explicit fixture opt-in')
}

const secret = process.env.WEWED_UAT_FIXTURE_SECRET
if (!secret || secret.length < 32) throw new Error('Missing fixture seed secret')

// Optional on first provision, but when supplied this must be the active UAT
// Planner user. The authenticated preview-only repair route can attach an
// existing fixture without hard-coding a personal account into the repository.
const plannerUserId = process.env.WEWED_UAT_PLANNER_USER_ID?.trim() || null

const db = new PrismaClient()
try {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.wedding.findUnique({ where: { id: weddingId } })
    if (
      existing &&
      (existing.slug !== slug ||
        existing.title !== 'Wewed PR 202 — Synthetic UAT' ||
        existing.coupleId !== weddingId + '-couple')
    ) {
      throw new Error('Fixture identity mismatch')
    }

    const wedding = existing
      ? await tx.wedding.update({
          where: { id: weddingId },
          data: {
            privacy: 'link_only',
            invitationCardStyle: 'ivory-floral-gold',
            monogram: 'AB',
          },
        })
      : await tx.wedding.create({
          data: {
            id: weddingId,
            slug,
            title: 'Wewed PR 202 — Synthetic UAT',
            date: new Date('2027-04-24T12:00:00Z'),
            venue: 'Synthetic UAT Venue',
            venueCity: 'Test City',
            venueCountry: 'Test Country',
            privacy: 'link_only',
            invitationCardStyle: 'ivory-floral-gold',
            monogram: 'AB',
            couple: {
              create: {
                id: weddingId + '-couple',
                slug: weddingId + '-couple',
                partner1: 'UAT Partner One',
                partner2: 'UAT Partner Two',
              },
            },
          },
        })

    let plannerBound = false
    if (plannerUserId) {
      const planner = await tx.user.findUnique({
        where: { id: plannerUserId },
        select: { id: true, role: true, isActive: true },
      })
      if (!planner || planner.role !== 'planner' || !planner.isActive) {
        throw new Error('WEWED_UAT_PLANNER_USER_ID must identify an active Planner')
      }

      const membershipId = `pr202-planner-${planner.id}`
      await tx.$executeRaw`
        INSERT INTO public."WeddingMembership"
          (id,"userId","weddingId",role,status,permissions,"acceptedAt","createdAt","updatedAt")
        VALUES
          (${membershipId},${planner.id},${weddingId},'planner','active',NULL,NOW(),NOW(),NOW())
        ON CONFLICT ("userId","weddingId") DO UPDATE SET
          role='planner',
          status='active',
          "acceptedAt"=COALESCE(public."WeddingMembership"."acceptedAt",NOW()),
          "revokedAt"=NULL,
          "updatedAt"=NOW()
      `

      const planningAccounts = await tx.$queryRaw<Array<{ businessAccountId: string }>>`
        SELECT bam."businessAccountId" AS "businessAccountId"
        FROM public."BusinessAccountMember" bam
        JOIN public."BusinessAccount" ba
          ON ba.id = bam."businessAccountId"
        WHERE bam."userId" = ${planner.id}
          AND bam.status = 'active'
          AND ba.type = 'planning_company'
          AND ba.status = 'active'
          AND ba."onboardingStatus" = 'complete'
        ORDER BY
          CASE WHEN ba."ownerUserId" = ${planner.id} THEN 0 ELSE 1 END,
          ba."createdAt" ASC
      `

      if (planningAccounts.length === 0) {
        throw new Error('UAT Planner has no active governed planning-company account')
      }

      for (const account of planningAccounts) {
        const linkId = `pr202-manages-${account.businessAccountId}-${weddingId}`
        await tx.$executeRaw`
          INSERT INTO public."BusinessAccountLink"
            (id,"businessAccountId","entityType","entityId",relationship)
          VALUES
            (${linkId},${account.businessAccountId},'wedding',${weddingId},'manages')
          ON CONFLICT ("businessAccountId","entityType","entityId") DO UPDATE SET
            relationship='manages'
        `
      }
      plannerBound = true
    }

    for (const label of ['A', 'B']) {
      const id = `${weddingId}-guest-${label.toLowerCase()}`
      const guest = await tx.guest.findUnique({ where: { id }, include: { rsvp: true } })
      if (guest && (guest.weddingId !== weddingId || guest.name !== `UAT Guest ${label}`)) {
        throw new Error('Guest fixture mismatch')
      }
      if (!guest) {
        await tx.guest.create({
          data: {
            id,
            name: `UAT Guest ${label}`,
            weddingId,
            rsvp: {
              create: {
                token: createHmac('sha256', secret).update(id).digest('base64url'),
              },
            },
          },
        })
      }
    }

    const id = 'print_UAT2020912'
    const qr = await tx.qRDestination.findUnique({ where: { id } })
    if (qr && qr.weddingId !== weddingId) throw new Error('Physical fixture mismatch')
    const qrData = {
      label: 'PR 202 synthetic UAT physical invitation',
      type: 'physical_invitation',
      url: `/w/${slug}?card=ivory-floral-gold`,
      isActive: true,
    }
    if (qr) {
      await tx.qRDestination.update({ where: { id }, data: qrData })
    } else {
      await tx.qRDestination.create({ data: { id, weddingId, ...qrData } })
    }

    const vendorId = `${weddingId}-vendor-photo`
    const engagementId = `${weddingId}-engagement-photo`
    const honeymoonBudgetId = `${weddingId}-budget-honeymoon`
    const photoBudgetId = `${weddingId}-budget-photo`

    await tx.vendor.upsert({
      where: { id: vendorId },
      update: { name: 'UAT Photography Vendor', category: 'photographer' },
      create: {
        id: vendorId,
        weddingId,
        name: 'UAT Photography Vendor',
        category: 'photographer',
      },
    })

    await tx.serviceEngagement.upsert({
      where: { id: engagementId },
      update: {
        serviceCategory: 'Photography',
        serviceDescription: 'Synthetic UAT photography service',
        agreedAmount: 1200,
        currency: 'USD',
        vendorId,
        origin: 'current',
        recordMode: 'record_only',
        lifecycleStatus: 'draft',
      },
      create: {
        id: engagementId,
        weddingId,
        vendorId,
        serviceCategory: 'Photography',
        serviceDescription: 'Synthetic UAT photography service',
        agreedAmount: 1200,
        currency: 'USD',
        origin: 'current',
        recordMode: 'record_only',
        lifecycleStatus: 'draft',
      },
    })

    await tx.budgetItem.upsert({
      where: { id: honeymoonBudgetId },
      update: {
        category: 'honeymoon',
        description: 'UAT Honeymoon Adventures',
        estimatedCost: 2500,
        currency: 'USD',
        paidAmount: 0,
      },
      create: {
        id: honeymoonBudgetId,
        weddingId,
        category: 'honeymoon',
        description: 'UAT Honeymoon Adventures',
        estimatedCost: 2500,
        currency: 'USD',
        paidAmount: 0,
      },
    })

    await tx.budgetItem.upsert({
      where: { id: photoBudgetId },
      update: {
        category: 'photo_video',
        description: 'UAT Photography',
        estimatedCost: 1200,
        actualCost: 1200,
        currency: 'USD',
        paidAmount: 0,
        vendorId,
        vendorName: 'UAT Photography Vendor',
        serviceEngagementId: engagementId,
      },
      create: {
        id: photoBudgetId,
        weddingId,
        category: 'photo_video',
        description: 'UAT Photography',
        estimatedCost: 1200,
        actualCost: 1200,
        currency: 'USD',
        paidAmount: 0,
        vendorId,
        vendorName: 'UAT Photography Vendor',
        serviceEngagementId: engagementId,
      },
    })

    await tx.$executeRaw`
      INSERT INTO wewed_contributions.wedding_settings (wedding_id, accepting_contributions, disabled_message)
      VALUES (${weddingId}, TRUE, 'Your presence and good wishes are more than enough.')
      ON CONFLICT (wedding_id) DO UPDATE SET
        accepting_contributions=TRUE,
        disabled_message=EXCLUDED.disabled_message,
        updated_at=NOW()
    `

    await tx.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,public_note,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id)
      VALUES
        (${weddingId + '-campaign-honeymoon'},${weddingId},'HONEYMOON','Honeymoon Adventures','Optional support for the couple''s future adventures.',2500,'USD',TRUE,TRUE,TRUE,TRUE,TRUE,'Choose only what feels meaningful to you.',TRUE,0,'["CASH_TO_COUPLE","HONEYMOON_GIFT"]'::jsonb,${honeymoonBudgetId},NULL)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title,
        description=EXCLUDED.description,
        target_amount=EXCLUDED.target_amount,
        currency=EXCLUDED.currency,
        published=TRUE,
        show_target=TRUE,
        show_raised=TRUE,
        invitation_visible=TRUE,
        show_contributor_recognition=TRUE,
        public_note=EXCLUDED.public_note,
        enabled=TRUE,
        sort_order=0,
        accepted_types=EXCLUDED.accepted_types,
        budget_item_id=EXCLUDED.budget_item_id,
        service_engagement_id=NULL,
        updated_at=NOW()
    `

    await tx.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,public_note,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id)
      VALUES
        (${weddingId + '-campaign-photo'},${weddingId},'WEDDING_SUPPORT','Photography Support','Guests may choose to pay part of the photography service directly.',1200,'USD',TRUE,TRUE,TRUE,TRUE,FALSE,'This option is linked to the real Planner vendor service.',TRUE,1,'["DIRECT_VENDOR_PAYMENT"]'::jsonb,${photoBudgetId},${engagementId})
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title,
        description=EXCLUDED.description,
        target_amount=EXCLUDED.target_amount,
        currency=EXCLUDED.currency,
        published=TRUE,
        show_target=TRUE,
        show_raised=TRUE,
        invitation_visible=TRUE,
        show_contributor_recognition=FALSE,
        public_note=EXCLUDED.public_note,
        enabled=TRUE,
        sort_order=1,
        accepted_types=EXCLUDED.accepted_types,
        budget_item_id=EXCLUDED.budget_item_id,
        service_engagement_id=EXCLUDED.service_engagement_id,
        updated_at=NOW()
    `

    return {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      invitationCardStyle: wedding.invitationCardStyle,
      guests: 2,
      physicalCode: 'UAT2020912',
      contributionCampaigns: 2,
      plannerBound,
    }
  })

  console.log('PR202_UAT_FIXTURE', JSON.stringify(result))
} finally {
  await db.$disconnect()
}
