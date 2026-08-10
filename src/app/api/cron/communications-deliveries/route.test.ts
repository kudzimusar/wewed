import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test } from 'bun:test'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/cron/communications-deliveries/route'
import { db } from '@/lib/db'

async function clearCredential() {
  await db.$executeRaw(Prisma.sql`
    DELETE FROM wewed_communications."CommunicationSchedulerCredential"
    WHERE "id" = 'automatic_dispatch'
  `)
}

async function storeCredential(token: string) {
  const secretHash = createHash('sha256').update(token).digest('hex')
  await db.$executeRaw(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationSchedulerCredential"
      ("id", "secretHash", "createdAt", "updatedAt")
    VALUES ('automatic_dispatch', ${secretHash}, now(), now())
    ON CONFLICT ("id") DO UPDATE SET
      "secretHash" = EXCLUDED."secretHash", "updatedAt" = now()
  `)
}

afterEach(async () => {
  await clearCredential()
})

describe('communications scheduler HTTP boundary', () => {
  test('fails closed when no scheduler credential is provisioned', async () => {
    await clearCredential()
    const response = await POST(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { method: 'POST' },
    ))
    expect(response.status).toBe(404)
  })

  test('rejects a missing or incorrect bearer credential', async () => {
    await storeCredential('scheduler-secret')

    const missing = await POST(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { method: 'POST' },
    ))
    expect(missing.status).toBe(404)

    const incorrect = await POST(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { method: 'POST', headers: { authorization: 'Bearer wrong-secret' } },
    ))
    expect(incorrect.status).toBe(404)
  })

  test('runs the queue worker for the private scheduler credential', async () => {
    await storeCredential('scheduler-secret')
    const response = await POST(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { method: 'POST', headers: { authorization: 'Bearer scheduler-secret' } },
    ))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: { processed: 0, deliveries: [] },
    })
  })
})
