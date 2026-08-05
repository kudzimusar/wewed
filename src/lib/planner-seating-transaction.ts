import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const SERIALIZABLE_RETRY_LIMIT = 3

export class SeatingCapacityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeatingCapacityError'
  }
}

export class SeatingTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeatingTargetError'
  }
}

function isSerializableConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  return code === 'P2034' || /serialization|write conflict|deadlock/i.test(message)
}

/**
 * Run a seating mutation at SERIALIZABLE isolation and retry transaction
 * conflicts. Capacity reads and writes therefore share one atomic boundary.
 */
export async function runSerializableSeatingTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!isSerializableConflict(error) || attempt === SERIALIZABLE_RETRY_LIMIT) throw error
    }
  }
  throw new Error('Unable to complete the seating transaction.')
}
