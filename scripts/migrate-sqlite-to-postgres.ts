import { PrismaClient as PostgresPrismaClient } from '@prisma/client'
import { PrismaClient as SqlitePrismaClient } from '../node_modules/.prisma/sqlite-client'
import { resolve } from 'node:path'

const EXPECTED_PROJECT_REF = 'kjigkhjdeymukwradoqu'

const models = [
  ['couple', 'Couple'],
  ['wedding', 'Wedding'],
  ['user', 'User'],
  ['userProfile', 'UserProfile'],
  ['seatingTable', 'SeatingTable'],
  ['guest', 'Guest'],
  ['rSVP', 'RSVP'],
  ['guestContribution', 'GuestContribution'],
  ['song', 'Song'],
  ['mediaItem', 'MediaItem'],
  ['message', 'Message'],
  ['product', 'Product'],
  ['vendor', 'Vendor'],
  ['programmeItem', 'ProgrammeItem'],
  ['kid', 'Kid'],
  ['plannerTask', 'PlannerTask'],
  ['budgetItem', 'BudgetItem'],
  ['importJob', 'ImportJob'],
  ['contentRevision', 'ContentRevision'],
  ['contentSubmission', 'ContentSubmission'],
  ['auditEvent', 'AuditEvent'],
  ['googleSheetsConnection', 'GoogleSheetsConnection'],
  ['qRDestination', 'QRDestination'],
  ['themePreference', 'ThemePreference'],
  ['weddingContent', 'WeddingContent'],
  ['comment', 'Comment'],
] as const

type Delegate = {
  count(): Promise<number>
  findMany(): Promise<Record<string, unknown>[]>
  createMany(args: {
    data: Record<string, unknown>[]
  }): Promise<{ count: number }>
}

function getDelegate(client: unknown, name: string): Delegate {
  const delegate = (client as Record<string, unknown>)[name]

  if (!delegate) {
    throw new Error(`Prisma delegate not found: ${name}`)
  }

  return delegate as Delegate
}

const sqlitePath = resolve(process.cwd(), 'db/custom.db')
const sqliteUrl = `file:${sqlitePath}`

const source = new SqlitePrismaClient({
  datasources: {
    db: {
      url: sqliteUrl,
    },
  },
})

async function readSourceData() {
  const records = new Map<string, Record<string, unknown>[]>()
  let total = 0

  for (const [delegateName, modelName] of models) {
    const rows = await getDelegate(source, delegateName).findMany()
    records.set(delegateName, rows)
    total += rows.length
    console.log(`${modelName}: ${rows.length}`)
  }

  console.log(`Total: ${total}`)
  return { records, total }
}

async function run() {
  const sourceData = await readSourceData()

  if (process.argv.includes('--source-check')) {
    return
  }

  const targetUrl = process.env.WEWED_DIRECT_URL?.trim()

  if (!targetUrl) {
    throw new Error('WEWED_DIRECT_URL is required')
  }

  if (!targetUrl.includes(EXPECTED_PROJECT_REF)) {
    throw new Error('The connection does not belong to the Wewed project')
  }

  const parsedUrl = new URL(targetUrl)

  if (parsedUrl.port === '6543') {
    throw new Error('Use the session or direct connection on port 5432')
  }

  const target = new PostgresPrismaClient({
    datasources: {
      db: {
        url: targetUrl,
      },
    },
  })

  try {
    let existingRows = 0

    for (const [delegateName] of models) {
      existingRows += await getDelegate(target, delegateName).count()
    }

    if (existingRows !== 0) {
      throw new Error(
        `Target database is not empty: ${existingRows} existing rows`
      )
    }

    await target.$transaction(
      async (transaction) => {
        for (const [delegateName, modelName] of models) {
          const rows = sourceData.records.get(delegateName) ?? []

          if (rows.length === 0) {
            continue
          }

          const result = await getDelegate(
            transaction,
            delegateName
          ).createMany({ data: rows })

          if (result.count !== rows.length) {
            throw new Error(
              `${modelName}: expected ${rows.length}, inserted ${result.count}`
            )
          }

          console.log(`${modelName}: inserted ${result.count}`)
        }
      },
      {
        maxWait: 10000,
        timeout: 120000,
      }
    )

    let importedRows = 0

    for (const [delegateName] of models) {
      importedRows += await getDelegate(target, delegateName).count()
    }

    if (importedRows !== sourceData.total) {
      throw new Error(
        `Verification failed: expected ${sourceData.total}, found ${importedRows}`
      )
    }

    console.log(`Migration verified: ${importedRows} rows`)
  } finally {
    await target.$disconnect()
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await source.$disconnect()
  })
