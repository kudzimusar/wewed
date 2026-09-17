import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

test.describe('Wewed Wedding Pass — Contract & Security Verification @mobile', () => {
  const fixturesPath = path.resolve(__dirname, '../fixtures/mock-wedding-data.json')
  const raw = fs.readFileSync(fixturesPath, 'utf-8')
  const data = JSON.parse(raw)

  test('PASS-01: Canonical mock pass contains all required Zimbabwe-first fields', async () => {
    const pass = data.samplePass
    expect(pass.token).toBeTruthy()
    expect(pass.coupleNames).toBe('Tariro & Shadreck')
    expect(pass.weddingDate).toContain('2026-10-24')
    expect(pass.venueName).toBe('Imba Manor Estate')
    expect(pass.guestName).toBe('Jane & Michael Doe')
    expect(pass.partySize).toBe(2)
    expect(pass.tableNumber).toBe(8)
    expect(pass.tableName).toBe('Jacaranda — 8')
    expect(pass.qrPayload).toBeTruthy()
  })

  test('PASS-02: QR credential satisfies WW1 cryptographic token format', async () => {
    const token = data.samplePass.qrPayload
    const parts = token.split('.')

    expect(parts.length).toBe(6)
    expect(parts[0]).toBe('WW1')
    expect(parts[1]).toBe('wedts26')
    expect(parts[2]).toBe('WWJD0824')
    
    // Check bitmask (0x0e = 14)
    const bitmask = parseInt(parts[3], 16)
    expect(bitmask).toBe(14)
    // Entitled to ceremony (bit 0x02) and reception (bit 0x08)
    expect(bitmask & 0x02).toBe(0x02)
    expect(bitmask & 0x08).toBe(0x08)

    // Nonce & signature lengths
    expect(parts[4].length).toBe(8)
    expect(parts[5].length).toBe(16)
  })

  test('PASS-03: Zero PII exists in QR payload string', async () => {
    const token = data.samplePass.qrPayload
    // Must NOT contain guest name, phone, email, or table
    expect(token).not.toContain('Jane')
    expect(token).not.toContain('Michael')
    expect(token).not.toContain('Doe')
    expect(token).not.toContain('Jacaranda')
    expect(token).not.toContain('@')
  })

  test('PASS-04: Offline manifest payload is within bandwidth budget (< 50KB)', async () => {
    const jsonBytes = Buffer.byteLength(JSON.stringify(data), 'utf-8')
    expect(jsonBytes).toBeLessThan(50 * 1024)
  })
})
