import { PrismaClient } from '@prisma/client'

export const E2E_USER = {
  id: 'e2e-planner-user',
  authUserId: 'e2e-supabase-auth-user',
  email: 'planner.e2e@example.test',
  name: 'Planner E2E',
} as const

export const E2E_WEDDINGS = {
  primary: {
    coupleId: 'e2e-couple-primary',
    id: 'e2e-wedding-primary',
    slug: 'aurora-blake-e2e',
    title: 'Aurora & Blake — E2E Wedding',
    seededTask: 'Primary wedding seeded task',
    seededVendor: 'Primary Test Venue',
    seededGuest: 'Primary Test Guest',
    seededTimeline: 'Primary ceremony',
    seededTable: 'Primary Family Table',
  },
  secondary: {
    coupleId: 'e2e-couple-secondary',
    id: 'e2e-wedding-secondary',
    slug: 'cedar-drew-e2e',
    title: 'Cedar & Drew — Isolation Wedding',
    seededTask: 'Secondary wedding private task',
    seededVendor: 'Secondary Test Florist',
    seededGuest: 'Secondary Test Guest',
    seededTimeline: 'Secondary reception',
    seededTable: 'Secondary Friends Table',
  },
} as const

function assertSafeTarget(): void {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
  if (
    process.env.WEWED_E2E_MODE !== '1' ||
    process.env.CI !== 'true' ||
    process.env.VERCEL ||
    !localDatabase
  ) {
    throw new Error(
      'Refusing planner E2E fixture reset outside explicit CI mode on a local PostgreSQL database.',
    )
  }
}

async function clearEphemeralDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE table_row record;
    BEGIN
      FOR table_row IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', table_row.tablename);
      END LOOP;
    END $$;
  `)
}

async function seedWedding(
  prisma: PrismaClient,
  wedding: (typeof E2E_WEDDINGS)[keyof typeof E2E_WEDDINGS],
  secondary: boolean,
): Promise<void> {
  await prisma.couple.create({
    data: {
      id: wedding.coupleId,
      slug: wedding.slug,
      partner1: secondary ? 'Cedar' : 'Aurora',
      partner2: secondary ? 'Drew' : 'Blake',
      surname: 'Example',
      subscriptionStatus: 'active',
    },
  })

  await prisma.wedding.create({
    data: {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      monogram: secondary ? 'C&D' : 'A&B',
      tagline: 'Deterministic browser-test wedding',
      date: new Date(secondary ? '2027-09-18T13:00:00.000Z' : '2027-06-12T13:00:00.000Z'),
      venue: secondary ? 'Secondary Test Gardens' : 'Primary Test Estate',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      venueMapUrl: 'https://example.test/map',
      lifecycle: 'before',
      privacy: 'private',
      subscriptionTier: 'canon',
      coupleId: wedding.coupleId,
    },
  })

  const table = await prisma.seatingTable.create({
    data: {
      id: `${wedding.id}-table`,
      name: wedding.seededTable,
      capacity: secondary ? 6 : 8,
      position: JSON.stringify({ x: secondary ? 300 : 100, y: 100 }),
      weddingId: wedding.id,
    },
  })

  const guest = await prisma.guest.create({
    data: {
      id: `${wedding.id}-guest`,
      name: wedding.seededGuest,
      email: `${secondary ? 'secondary' : 'primary'}.guest@example.test`,
      phone: secondary ? '+263000002002' : '+263000001001',
      role: 'guest',
      side: secondary ? 'partner2' : 'partner1',
      seatingTableId: table.id,
      weddingId: wedding.id,
    },
  })

  await prisma.rSVP.create({
    data: {
      id: `${wedding.id}-rsvp`,
      token: `${wedding.slug}-rsvp-token`,
      attending: true,
      plusOne: false,
      kidsAttending: false,
      kidsCount: 0,
      checkedIn: false,
      guestId: guest.id,
    },
  })

  await prisma.vendor.create({
    data: {
      id: `${wedding.id}-vendor`,
      name: wedding.seededVendor,
      category: secondary ? 'florist' : 'venue',
      description: 'Synthetic browser-test vendor',
      website: 'https://example.test/vendor',
      phone: secondary ? '+263000004004' : '+263000003003',
      contact: 'Test Contact',
      contractStatus: 'signed',
      paymentStatus: 'deposit',
      planningRating: 4,
      notes: secondary ? 'Secondary-only notes' : 'Primary-only notes',
      weddingId: wedding.id,
    },
  })

  await prisma.plannerTask.create({
    data: {
      id: `${wedding.id}-task`,
      title: wedding.seededTask,
      description: secondary ? 'Must never appear in the primary wedding.' : 'Primary fixture task.',
      category: 'venue',
      status: 'todo',
      priority: 'high',
      dueDate: new Date('2027-01-15T09:00:00.000Z'),
      assignee: 'Planner E2E',
      order: 1,
      weddingId: wedding.id,
    },
  })

  await prisma.budgetItem.create({
    data: {
      id: `${wedding.id}-budget`,
      category: secondary ? 'decor' : 'venue',
      description: secondary ? 'Secondary floral package' : 'Primary venue booking',
      estimatedCost: secondary ? 1800 : 5000,
      actualCost: secondary ? null : 4800,
      paidAmount: secondary ? 300 : 2400,
      currency: 'USD',
      dueDate: new Date('2027-02-01T00:00:00.000Z'),
      weddingId: wedding.id,
    },
  })

  await prisma.programmeItem.create({
    data: {
      id: `${wedding.id}-timeline`,
      time: secondary ? '17:00' : '15:00',
      title: wedding.seededTimeline,
      description: 'Synthetic operational run-sheet entry',
      duration: '45 minutes',
      location: secondary ? 'Secondary Hall' : 'Primary Lawn',
      displayIcon: 'Heart',
      order: 1,
      weddingId: wedding.id,
    },
  })
}

export async function resetPlannerE2EFixture(): Promise<void> {
  assertSafeTarget()
  const prisma = new PrismaClient()
  try {
    await clearEphemeralDatabase(prisma)
    await seedWedding(prisma, E2E_WEDDINGS.primary, false)
    await seedWedding(prisma, E2E_WEDDINGS.secondary, true)

    await prisma.user.create({
      data: {
        id: E2E_USER.id,
        email: E2E_USER.email,
        name: E2E_USER.name,
        role: 'planner',
        currentWeddingId: E2E_WEDDINGS.primary.id,
        isActive: true,
      },
    })

    await prisma.weddingMembership.createMany({
      data: [
        {
          id: 'e2e-membership-primary',
          userId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          role: 'planner',
          status: 'active',
          acceptedAt: new Date(),
        },
        {
          id: 'e2e-membership-secondary',
          userId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.secondary.id,
          role: 'planner',
          status: 'active',
          acceptedAt: new Date(),
        },
      ],
    })
  } finally {
    await prisma.$disconnect()
  }
}
