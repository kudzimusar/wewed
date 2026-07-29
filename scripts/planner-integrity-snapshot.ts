import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { db } from '../src/lib/db'
import {
  comparePlannerIntegrity,
  createPlannerIntegritySnapshot,
  type PlannerIntegritySnapshot,
  type PlannerIntegrityWeddingInput,
} from '../src/lib/planner-integrity'

interface Options {
  wedding?: string
  output?: string
  compare?: string
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function parseOptions(args: string[]): Options {
  return {
    wedding: optionValue(args, '--wedding'),
    output: optionValue(args, '--output'),
    compare: optionValue(args, '--compare'),
  }
}

function usage(): string {
  return [
    'Read-only Wewed planner integrity snapshot',
    '',
    'Usage:',
    '  bun scripts/planner-integrity-snapshot.ts [options]',
    '',
    'Options:',
    '  --wedding <id-or-slug>  Snapshot one wedding, including the flagship client.',
    '  --output <file>          Write the snapshot JSON to a file.',
    '  --compare <file>         Compare with a previous snapshot; exits non-zero on change.',
    '',
    'Examples:',
    '  bun scripts/planner-integrity-snapshot.ts --output before.json',
    '  bun scripts/planner-integrity-snapshot.ts --wedding charity-kudzie --output charity-before.json',
    '  bun scripts/planner-integrity-snapshot.ts --compare before.json --output after.json',
  ].join('\n')
}

async function loadWeddingData(selector?: string): Promise<PlannerIntegrityWeddingInput[]> {
  const weddings = await db.wedding.findMany({
    where: selector
      ? {
          OR: [{ id: selector }, { slug: selector }],
        }
      : undefined,
    include: {
      memberships: { orderBy: { id: 'asc' } },
      plannerTasks: { orderBy: { id: 'asc' } },
      budgetItems: { orderBy: { id: 'asc' } },
      vendors: { orderBy: { id: 'asc' } },
      guests: {
        include: { rsvp: true },
        orderBy: { id: 'asc' },
      },
      programmeItems: { orderBy: { id: 'asc' } },
      seatingTables: { orderBy: { id: 'asc' } },
      importJobs: { orderBy: { id: 'asc' } },
      contentRevisions: { orderBy: { id: 'asc' } },
    },
    orderBy: { id: 'asc' },
  })

  return weddings as unknown as PlannerIntegrityWeddingInput[]
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const options = parseOptions(args)
  const weddings = await loadWeddingData(options.wedding)
  if (options.wedding && weddings.length === 0) {
    throw new Error(`Wedding not found: ${options.wedding}`)
  }

  const snapshot = createPlannerIntegritySnapshot(weddings)
  const json = `${JSON.stringify(snapshot, null, 2)}\n`

  if (options.output) {
    const outputPath = resolve(options.output)
    await writeFile(outputPath, json, 'utf8')
    console.log(`Planner integrity snapshot written to ${outputPath}`)
  } else {
    process.stdout.write(json)
  }

  if (options.compare) {
    const previous = JSON.parse(
      await readFile(resolve(options.compare), 'utf8'),
    ) as PlannerIntegritySnapshot
    const differences = comparePlannerIntegrity(previous, snapshot)

    if (differences.length > 0) {
      console.error(`Planner integrity changed in ${differences.length} protected value(s):`)
      console.error(JSON.stringify(differences, null, 2))
      process.exitCode = 1
    } else {
      console.log('Planner integrity matches the comparison snapshot.')
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
