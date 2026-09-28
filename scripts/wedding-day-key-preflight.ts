#!/usr/bin/env bun
/**
 * Standalone CLI script for Wedding Day signing-key preflight.
 *
 * Safe for execution in production and deployment environments:
 * - Never prints or leaks private keys.
 * - Only outputs public key SHA-256 fingerprints, key IDs, and verification statuses.
 * - Exits with code 0 when all checks pass, code 1 when absent or failing.
 *
 * Usage:
 *   bun scripts/wedding-day-key-preflight.ts
 */

import { weddingDayKeyPreflight, formatKeyPreflightReport } from '../src/lib/wedding-day-key-preflight'

function main(): void {
  const report = weddingDayKeyPreflight(process.env)
  console.log(formatKeyPreflightReport(report))
  if (!report.ok) {
    process.exit(1)
  }
}

main()
