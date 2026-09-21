#!/usr/bin/env bun
/**
 * Operator entry point for the Wedding Day signing-key preflight.
 *
 *   bun run scripts/wedding-day-key-preflight.ts
 *
 * Reads the four WEDDING_DAY_* variables from the environment and reports whether they are usable.
 * It configures nothing and prints no private key material. Exit status is 0 when ready, 1 when not,
 * so it can gate a deployment step.
 */
import { formatKeyPreflightReport, weddingDayKeyPreflight } from '../src/lib/wedding-day-key-preflight'

const report = weddingDayKeyPreflight()
console.log(formatKeyPreflightReport(report))
process.exit(report.ok ? 0 : 1)
