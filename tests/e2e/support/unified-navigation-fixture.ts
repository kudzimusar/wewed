import { PrismaClient } from '@prisma/client'
import { resetMarketplaceE2EFixture } from './marketplace-fixture'
import { E2E_WEDDINGS } from './planner-fixture'

export const E2E_GUEST_INVITATION = {
  guestId: `${E2E_WEDDINGS.primary.id}-guest`,
  token: `${E2E_WEDDINGS.primary.slug}-rsvp-token`,
} as const

export async function resetUnifiedNavigationFixture(): Promise<void> {
  await resetMarketplaceE2EFixture()
  const prisma = new PrismaClient()
  try {
    await prisma.$transaction([
      prisma.wedding.update({
        where: { id: E2E_WEDDINGS.primary.id },
        data: {
          privacy: 'link_only',
          invitationCardStyle: 'botanical',
          invitationCardMessage: null,
          rsvpDeadline: null,
        },
      }),
      prisma.rSVP.update({
        where: { guestId: E2E_GUEST_INVITATION.guestId },
        data: {
          token: E2E_GUEST_INVITATION.token,
          checkedIn: false,
          checkedInAt: null,
        },
      }),
    ])
  } finally {
    await prisma.$disconnect()
  }
}

export async function rotateUnifiedGuestToken(): Promise<string> {
  const prisma = new PrismaClient()
  const nextToken = `${E2E_WEDDINGS.primary.slug}-rotated-${Date.now()}`
  try {
    await prisma.rSVP.update({
      where: { guestId: E2E_GUEST_INVITATION.guestId },
      data: { token: nextToken },
    })
    return nextToken
  } finally {
    await prisma.$disconnect()
  }
}
