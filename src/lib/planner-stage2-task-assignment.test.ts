import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, test } from 'bun:test'
import { db } from './db'

interface Fixture {
  coupleId: string
  weddingId: string
  actorId: string
  assigneeId: string
}

const fixtures: Fixture[] = []

afterAll(async () => {
  for (const fixture of fixtures) {
    await db.contentRevision.deleteMany({ where: { weddingId: fixture.weddingId } })
    await db.plannerTask.deleteMany({ where: { weddingId: fixture.weddingId } })
    await db.weddingMembership.deleteMany({ where: { weddingId: fixture.weddingId } })
    await db.user.deleteMany({ where: { id: { in: [fixture.actorId, fixture.assigneeId] } } })
    await db.wedding.deleteMany({ where: { id: fixture.weddingId } })
    await db.couple.deleteMany({ where: { id: fixture.coupleId } })
  }
  await db.$disconnect()
})

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID()
  const couple = await db.couple.create({
    data: {
      slug: `task-assignment-couple-${suffix}`,
      partner1: 'Original',
      partner2: 'Planner',
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `task-assignment-wedding-${suffix}`,
      title: 'Task Assignment Test',
      date: new Date('2027-02-01T00:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  const actor = await db.user.create({
    data: {
      email: `actor-${suffix}@example.com`,
      name: 'Test Planner',
      role: 'planner',
      currentWeddingId: wedding.id,
    },
  })
  const assignee = await db.user.create({
    data: {
      email: `assignee-${suffix}@example.com`,
      name: 'Team Member',
      role: 'coordinator',
      currentWeddingId: wedding.id,
    },
  })
  await db.weddingMembership.createMany({
    data: [
      {
        userId: actor.id,
        weddingId: wedding.id,
        role: 'planner',
        status: 'active',
        acceptedAt: new Date(),
      },
      {
        userId: assignee.id,
        weddingId: wedding.id,
        role: 'coordinator',
        status: 'active',
        acceptedAt: new Date(),
      },
    ],
  })

  const fixture = {
    coupleId: couple.id,
    weddingId: wedding.id,
    actorId: actor.id,
    assigneeId: assignee.id,
  }
  fixtures.push(fixture)
  return fixture
}

function assignmentValue(input: {
  taskId: string
  assigneeUserId: string | null
  assigneeName: string | null
  actorId: string
}) {
  return JSON.stringify({
    version: 1,
    taskId: input.taskId,
    assigneeUserId: input.assigneeUserId,
    assigneeName: input.assigneeName,
    assignedById: input.actorId,
    assignedAt: new Date().toISOString(),
  })
}

describe('Stage 2 normalized task team assignment', () => {
  test('Team Hub assignment preserves the original free-text assignee', async () => {
    const fixture = await createFixture()
    const task = await db.plannerTask.create({
      data: {
        title: 'Coordinate family arrivals',
        category: 'wedding_day',
        assignee: 'Couple',
        weddingId: fixture.weddingId,
      },
    })

    await db.$transaction([
      db.plannerTask.update({
        where: { id: task.id },
        data: { assignee: 'Team Member' },
      }),
      db.contentRevision.create({
        data: {
          section: 'planner_task_assignment',
          fieldKey: task.id,
          value: assignmentValue({
            taskId: task.id,
            assigneeUserId: fixture.assigneeId,
            assigneeName: 'Team Member',
            actorId: fixture.actorId,
          }),
          status: 'active',
          weddingId: fixture.weddingId,
          authorId: fixture.actorId,
        },
      }),
    ])

    const assigned = await db.plannerTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(assigned.assignee).toBe('Couple')
    expect(assigned.assigneeUserId).toBe(fixture.assigneeId)
  })

  test('ordinary free-text editing remains independent from team ownership', async () => {
    const fixture = await createFixture()
    const task = await db.plannerTask.create({
      data: {
        title: 'Confirm family transport',
        category: 'transport',
        assignee: 'Family',
        assigneeUserId: fixture.assigneeId,
        weddingId: fixture.weddingId,
      },
    })
    await db.contentRevision.create({
      data: {
        section: 'planner_task_assignment',
        fieldKey: task.id,
        value: assignmentValue({
          taskId: task.id,
          assigneeUserId: fixture.assigneeId,
          assigneeName: 'Team Member',
          actorId: fixture.actorId,
        }),
        status: 'active',
        weddingId: fixture.weddingId,
        authorId: fixture.actorId,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    const edited = await db.plannerTask.update({
      where: { id: task.id },
      data: { assignee: 'Coordinator' },
    })

    expect(edited.assignee).toBe('Coordinator')
    expect(edited.assigneeUserId).toBe(fixture.assigneeId)
  })

  test('unassigning a team member does not erase the original planning label', async () => {
    const fixture = await createFixture()
    const task = await db.plannerTask.create({
      data: {
        title: 'Review ceremony details',
        category: 'spiritual',
        assignee: 'Couple',
        assigneeUserId: fixture.assigneeId,
        weddingId: fixture.weddingId,
      },
    })
    const revision = await db.contentRevision.create({
      data: {
        section: 'planner_task_assignment',
        fieldKey: task.id,
        value: assignmentValue({
          taskId: task.id,
          assigneeUserId: fixture.assigneeId,
          assigneeName: 'Team Member',
          actorId: fixture.actorId,
        }),
        status: 'active',
        weddingId: fixture.weddingId,
        authorId: fixture.actorId,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    await db.$transaction([
      db.plannerTask.update({
        where: { id: task.id },
        data: { assignee: null },
      }),
      db.contentRevision.update({
        where: { id: revision.id },
        data: {
          value: assignmentValue({
            taskId: task.id,
            assigneeUserId: null,
            assigneeName: null,
            actorId: fixture.actorId,
          }),
          status: 'active',
          authorId: fixture.actorId,
        },
      }),
    ])

    const unassigned = await db.plannerTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(unassigned.assignee).toBe('Couple')
    expect(unassigned.assigneeUserId).toBeNull()
  })

  test('deleting a user clears only the normalized relation', async () => {
    const fixture = await createFixture()
    const task = await db.plannerTask.create({
      data: {
        title: 'Supplier follow-up',
        category: 'other',
        assignee: 'Coordinator',
        assigneeUserId: fixture.assigneeId,
        weddingId: fixture.weddingId,
      },
    })

    await db.weddingMembership.deleteMany({ where: { userId: fixture.assigneeId } })
    await db.user.delete({ where: { id: fixture.assigneeId } })
    const updated = await db.plannerTask.findUniqueOrThrow({ where: { id: task.id } })

    expect(updated.assignee).toBe('Coordinator')
    expect(updated.assigneeUserId).toBeNull()
  })

  test('migration is additive and never infers ownership from free-text names', async () => {
    const [schema, migration] = await Promise.all([
      source('prisma/schema.prisma'),
      source('prisma/migrations/20260729134500_normalize_task_assignee/migration.sql'),
    ])

    expect(schema).toContain('assignee       String?')
    expect(schema).toContain('assigneeUserId String?')
    expect(schema).toContain('@relation("PlannerTaskAssignee"')
    expect(migration).toContain("revision.\"section\" = 'planner_task_assignment'")
    expect(migration).toContain('membership."status" = \'active\'')
    expect(migration).toContain('preserve_planner_task_text_assignee_trigger')
    expect(migration).not.toContain('SET "assignee" = assigned_user_id')
    expect(migration).not.toContain('WHERE "assignee" =')
    expect(migration).not.toContain('DROP COLUMN')
  })

  test('task APIs expose team ownership without replacing free-text editing', async () => {
    const [collectionRoute, itemRoute] = await Promise.all([
      source('src/app/api/planner/tasks/route.ts'),
      source('src/app/api/planner/tasks/[id]/route.ts'),
    ])

    expect(collectionRoute).toContain('assignee: string | null')
    expect(collectionRoute).toContain('assigneeUserId: string | null')
    expect(collectionRoute).toContain('assignee: body.assignee?.trim() || null')
    expect(itemRoute).toContain('assigneeUserId: string | null')
    expect(itemRoute).toContain('original free-text planning label')
    expect(itemRoute).toContain('updates.assignee = body.assignee?.trim() || null')
  })

  test('the original planner still contains its free-text assignee workflow', async () => {
    const original = await source('src/components/wedding/wedding-planner.tsx')

    expect(original).toContain("assignee: ''")
    expect(original).toContain('newTask.assignee')
    expect(original).toContain('task.assignee')
  })
})
