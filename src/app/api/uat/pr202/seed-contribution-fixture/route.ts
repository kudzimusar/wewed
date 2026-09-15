import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const wedding = await db.wedding.findUnique({ where: { id: WEDDING_ID }, select: { id: true, slug: true, title: true } })
  if (!wedding || wedding.slug !== WEDDING_ID || wedding.title !== 'Wewed PR 202 — Synthetic UAT') {
    return NextResponse.json({ success: false, error: 'Synthetic UAT wedding not found.' }, { status: 409 })
  }

  const vendorId = `${WEDDING_ID}-vendor-photo`
  const engagementId = `${WEDDING_ID}-engagement-photo`
  const honeymoonBudgetId = `${WEDDING_ID}-budget-honeymoon`
  const photoBudgetId = `${WEDDING_ID}-budget-photo`

  await db.vendor.upsert({
    where: { id: vendorId },
    update: { name: 'UAT Photography Vendor', category: 'photographer' },
    create: { id: vendorId, weddingId: WEDDING_ID, name: 'UAT Photography Vendor', category: 'photographer' },
  })

  await db.serviceEngagement.upsert({
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
      weddingId: WEDDING_ID,
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

  await db.budgetItem.upsert({
    where: { id: honeymoonBudgetId },
    update: { category: 'honeymoon', description: 'UAT Honeymoon Adventures', estimatedCost: 2500, currency: 'USD', paidAmount: 0 },
    create: { id: honeymoonBudgetId, weddingId: WEDDING_ID, category: 'honeymoon', description: 'UAT Honeymoon Adventures', estimatedCost: 2500, currency: 'USD', paidAmount: 0 },
  })

  await db.budgetItem.upsert({
    where: { id: photoBudgetId },
    update: { category: 'photo_video', description: 'UAT Photography', estimatedCost: 1200, actualCost: 1200, currency: 'USD', paidAmount: 0, vendorId, vendorName: 'UAT Photography Vendor', serviceEngagementId: engagementId },
    create: { id: photoBudgetId, weddingId: WEDDING_ID, category: 'photo_video', description: 'UAT Photography', estimatedCost: 1200, actualCost: 1200, currency: 'USD', paidAmount: 0, vendorId, vendorName: 'UAT Photography Vendor', serviceEngagementId: engagementId },
  })

  await db.$executeRaw`
    INSERT INTO wewed_contributions.wedding_settings (wedding_id, accepting_contributions, disabled_message)
    VALUES (${WEDDING_ID}, FALSE, 'Your presence and good wishes are more than enough.')
    ON CONFLICT (wedding_id) DO UPDATE
      SET accepting_contributions=FALSE,
          disabled_message=EXCLUDED.disabled_message,
          updated_at=NOW()
  `

  await db.$executeRaw`
    INSERT INTO wewed_contributions.campaigns
      (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,public_note,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id)
    VALUES
      (${WEDDING_ID + '-campaign-honeymoon'},${WEDDING_ID},'HONEYMOON','Honeymoon Adventures','Optional support for the couple''s future adventures.',2500,'USD',TRUE,TRUE,TRUE,TRUE,TRUE,'Choose only what feels meaningful to you.',TRUE,0,'["CASH_TO_COUPLE","HONEYMOON_GIFT"]'::jsonb,${honeymoonBudgetId},NULL)
    ON CONFLICT (id) DO UPDATE SET
      title=EXCLUDED.title,description=EXCLUDED.description,target_amount=EXCLUDED.target_amount,currency=EXCLUDED.currency,
      published=TRUE,show_target=TRUE,show_raised=TRUE,invitation_visible=TRUE,show_contributor_recognition=TRUE,
      public_note=EXCLUDED.public_note,enabled=TRUE,sort_order=0,accepted_types=EXCLUDED.accepted_types,
      budget_item_id=EXCLUDED.budget_item_id,service_engagement_id=NULL,updated_at=NOW()
  `

  await db.$executeRaw`
    INSERT INTO wewed_contributions.campaigns
      (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,public_note,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id)
    VALUES
      (${WEDDING_ID + '-campaign-photo'},${WEDDING_ID},'WEDDING_SUPPORT','Photography Support','Guests may choose to pay part of the photography service directly.',1200,'USD',TRUE,TRUE,TRUE,TRUE,FALSE,'This option is linked to the real Planner vendor service.',TRUE,1,'["DIRECT_VENDOR_PAYMENT"]'::jsonb,${photoBudgetId},${engagementId})
    ON CONFLICT (id) DO UPDATE SET
      title=EXCLUDED.title,description=EXCLUDED.description,target_amount=EXCLUDED.target_amount,currency=EXCLUDED.currency,
      published=TRUE,show_target=TRUE,show_raised=TRUE,invitation_visible=TRUE,show_contributor_recognition=FALSE,
      public_note=EXCLUDED.public_note,enabled=TRUE,sort_order=1,accepted_types=EXCLUDED.accepted_types,
      budget_item_id=EXCLUDED.budget_item_id,service_engagement_id=EXCLUDED.service_engagement_id,updated_at=NOW()
  `

  const campaigns = await db.$queryRaw<Array<{ title: string; sortOrder: number }>>`
    SELECT title,sort_order AS "sortOrder"
      FROM wewed_contributions.campaigns
     WHERE wedding_id=${WEDDING_ID}
     ORDER BY sort_order ASC,created_at ASC
  `

  return NextResponse.json({ success: true, acceptingContributions: false, campaigns })
}
