import { PrismaClient } from '@prisma/client'
import { E2E_USER, E2E_WEDDINGS, resetPlannerE2EFixture } from './planner-fixture'

export const E2E_COUPLE = { id: 'e2e-market-couple-user', authUserId: 'e2e-market-couple-auth', email: 'couple.marketplace@example.test', name: 'Aurora Couple' } as const
export const E2E_MARKETPLACE = { plannerBusinessId: 'e2e-market-planner-business', coupleBusinessId: 'e2e-market-couple-business', profileId: 'e2e-market-planner-profile', profileSlug: 'planner-e2e-marketplace' } as const

export async function resetMarketplaceE2EFixture(): Promise<void> {
  await resetPlannerE2EFixture()
  const prisma = new PrismaClient()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.weddingMembership.deleteMany({
        where: { userId: E2E_USER.id, weddingId: E2E_WEDDINGS.primary.id },
      })
      await tx.user.update({
        where: { id: E2E_USER.id },
        data: { currentWeddingId: E2E_WEDDINGS.secondary.id },
      })
      await tx.user.upsert({
        where: { id: E2E_COUPLE.id },
        create: {
          id: E2E_COUPLE.id,
          email: E2E_COUPLE.email,
          name: E2E_COUPLE.name,
          role: 'couple',
          coupleId: E2E_WEDDINGS.primary.coupleId,
          currentWeddingId: E2E_WEDDINGS.primary.id,
          isActive: true,
        },
        update: {
          email: E2E_COUPLE.email,
          name: E2E_COUPLE.name,
          role: 'couple',
          coupleId: E2E_WEDDINGS.primary.coupleId,
          currentWeddingId: E2E_WEDDINGS.primary.id,
          isActive: true,
        },
      })
      await tx.weddingMembership.upsert({
        where: {
          userId_weddingId: {
            userId: E2E_COUPLE.id,
            weddingId: E2E_WEDDINGS.primary.id,
          },
        },
        create: {
          id: 'e2e-market-couple-owner-membership',
          userId: E2E_COUPLE.id,
          weddingId: E2E_WEDDINGS.primary.id,
          role: 'owner',
          status: 'active',
          acceptedAt: new Date(),
        },
        update: {
          role: 'owner',
          status: 'active',
          acceptedAt: new Date(),
          revokedAt: null,
        },
      })

      await tx.$executeRawUnsafe(
        `DELETE FROM wewed_admin."BusinessAccount"
         WHERE id IN ('${E2E_MARKETPLACE.plannerBusinessId}','${E2E_MARKETPLACE.coupleBusinessId}')`,
      )
      await tx.$executeRawUnsafe(`INSERT INTO wewed_admin."BusinessAccount" (id,name,slug,type,status,"ownerUserId","onboardingStatus","subscriptionPlan","subscriptionStatus",metadata,"createdAt","updatedAt") VALUES
        ('${E2E_MARKETPLACE.plannerBusinessId}','Planner E2E Studio','planner-e2e-studio','planning_company','active','${E2E_USER.id}','complete','professional','active','{}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ('${E2E_MARKETPLACE.coupleBusinessId}','Aurora & Blake','aurora-blake-business','couple','active','${E2E_COUPLE.id}','complete','starter','active','{}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      await tx.$executeRawUnsafe(`INSERT INTO wewed_admin."BusinessAccountMember" (id,"businessAccountId","userId",role,status,permissions,"createdAt","updatedAt") VALUES
        ('e2e-market-planner-member','${E2E_MARKETPLACE.plannerBusinessId}','${E2E_USER.id}','business_owner','active','["weddings.manage"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ('e2e-market-couple-member','${E2E_MARKETPLACE.coupleBusinessId}','${E2E_COUPLE.id}','couple_owner','active','["account.manage"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      await tx.$executeRawUnsafe(`INSERT INTO wewed_admin."BusinessAccountLink" (id,"businessAccountId","entityType","entityId",relationship,"createdAt") VALUES
        ('e2e-market-couple-wedding','${E2E_MARKETPLACE.coupleBusinessId}','wedding','${E2E_WEDDINGS.primary.id}','owns',CURRENT_TIMESTAMP),
        ('e2e-market-planner-existing-wedding','${E2E_MARKETPLACE.plannerBusinessId}','wedding','${E2E_WEDDINGS.secondary.id}','manages',CURRENT_TIMESTAMP)`)
      await tx.$executeRawUnsafe(`INSERT INTO wewed_admin."PlannerProfile" (id,"businessAccountId",slug,"displayName",headline,bio,"yearsExperience","serviceAreas",services,"weddingStyles",languages,"priceBand","availabilityStatus",status,"publishedAt","createdAt","updatedAt") VALUES
        ('${E2E_MARKETPLACE.profileId}','${E2E_MARKETPLACE.plannerBusinessId}','${E2E_MARKETPLACE.profileSlug}','Planner E2E Studio','Secure full-service planning','Synthetic published planner profile for Chromium testing.',8,'["Harare"]','["Full planning"]','["Modern"]','["English"]','standard','accepting','published',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    })
  } finally {
    await prisma.$disconnect()
  }
}

export async function marketplaceMembershipStatus(): Promise<string | null> {
  const prisma = new PrismaClient()
  try {
    const row = await prisma.weddingMembership.findUnique({
      where: {
        userId_weddingId: {
          userId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
        },
      },
      select: { status: true },
    })
    return row?.status ?? null
  } finally {
    await prisma.$disconnect()
  }
}
