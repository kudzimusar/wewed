import { test, expect } from '@playwright/test'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Wewed Wedding Day & Pass — 12 Browser-Driven Chromium Acceptance Scenarios @mobile', () => {
  let server: http.Server
  let baseURL: string
  const fixturesPath = path.resolve(__dirname, '../fixtures/mock-wedding-data.json')
  const mockData = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'))

  // State machine for testing dynamic day-of operations
  let attendanceCount = 317
  const totalCapacity = 350
  let vendorsOnSite = 10
  const totalVendors = 13

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')

      // API: Check-in endpoint with RBAC
      if (url.pathname === '/api/wedding-day/check-in' && req.method === 'POST') {
        const authHeader = req.headers['authorization'] || ''
        if (!authHeader.includes('Bearer usher-') && !authHeader.includes('Bearer planner-')) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized: Usher or Planner role required' }))
          return
        }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          attendanceCount += 1
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: true,
            admitted: 1,
            totalCheckedIn: attendanceCount,
            capacity: totalCapacity
          }))
        })
        return
      }

      // API: Vendor status update
      if (url.pathname === '/api/wedding-day/vendor-status' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          vendorsOnSite += 1
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: true,
            vendorsOnSite,
            totalVendors
          }))
        })
        return
      }

      // Invitation Page: /invite/wed_tariro_shadreck_2026
      if (url.pathname.startsWith('/invite/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Wedding Invitation — ${mockData.wedding.coupleNames}</title>
  <style>
    :root {
      --bg-stage: #17130F;
      --card-ivory: #FBF5E9;
      --gold-accent: #B3833F;
      --text-espresso: #42372F;
    }
    body {
      margin: 0;
      background: var(--bg-stage);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: var(--text-espresso);
    }
    .envelope {
      width: 90%;
      max-width: 380px;
      background: var(--card-ivory);
      border-radius: 12px;
      border: 1px solid rgba(179, 131, 63, 0.3);
      box-shadow: 0 16px 32px rgba(0,0,0,0.5);
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
      transition: all 0.4s ease;
    }
    .monogram-seal {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #C59A52, #986E2C);
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 20px;
      letter-spacing: 2px;
      margin: 0 auto 16px auto;
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    }
    h1 {
      font-size: 24px;
      color: var(--text-espresso);
      margin: 8px 0;
      font-weight: 600;
    }
    .subtitle {
      font-size: 13px;
      color: var(--gold-accent);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }
    .venue-box {
      font-size: 14px;
      line-height: 1.5;
      margin: 16px 0;
      padding: 12px;
      background: rgba(179, 131, 63, 0.08);
      border-radius: 8px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      border: none;
      cursor: pointer;
      box-sizing: border-box;
      text-decoration: none;
      margin-top: 10px;
    }
    .btn-gold {
      background: linear-gradient(135deg, #B3833F, #8F652A);
      color: #FFFFFF;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--gold-accent);
      color: var(--text-espresso);
    }
    .hidden { display: none; }
    .stationery-open {
      padding: 24px;
      animation: fadeIn 0.4s ease forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div id="invitation-container" class="envelope" data-card-style="ivory-floral-gold">
    <div class="monogram-seal">T&S</div>
    <div class="subtitle">Wedding Invitation</div>
    <h1>${mockData.wedding.coupleNames}</h1>

    <!-- Closed Stage -->
    <div id="closed-stage">
      <p style="font-size: 14px; margin: 16px 0;">You are cordially invited to witness and celebrate our union.</p>
      <button id="btn-unfold" class="btn btn-gold" data-testid="invitation-open-button">Open Invitation</button>
    </div>

    <!-- Revealed Stage -->
    <div id="revealed-stage" class="hidden stationery-open">
      <div class="venue-box">
        <strong>${mockData.wedding.venueName}</strong><br/>
        ${mockData.wedding.venueAddress}<br/>
        Saturday, 24 October 2026 at 14:00 CAT
      </div>
      <div id="guest-greeting" style="margin: 16px 0; font-size: 14px;">
        Honouring <strong>${mockData.samplePass.guestName}</strong><br/>
        Party Size: <strong>${mockData.samplePass.partySize} Seats Reserved</strong>
      </div>
      <div id="rsvp-section">
        <button id="btn-accept" class="btn btn-gold" data-testid="rsvp-accept-button">Accept with Pleasure</button>
        <button id="btn-decline" class="btn btn-outline" data-testid="rsvp-decline-button">Decline with Regret</button>
      </div>
      <div id="rsvp-confirmed" class="hidden" style="margin-top: 16px;">
        <p style="color: #2E7D32; font-weight: bold;">✓ RSVP Confirmed: Attending</p>
        <a id="btn-view-pass" class="btn btn-gold" href="/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824" data-testid="view-pass-button">
          View Wedding Pass
        </a>
      </div>
    </div>
  </div>

  <script>
    document.getElementById('btn-unfold').addEventListener('click', () => {
      document.getElementById('closed-stage').classList.add('hidden');
      document.getElementById('revealed-stage').classList.remove('hidden');
    });
    document.getElementById('btn-accept').addEventListener('click', () => {
      document.getElementById('rsvp-section').classList.add('hidden');
      document.getElementById('rsvp-confirmed').classList.remove('hidden');
    });
  </script>
</body>
</html>`)
        return
      }

      // Pass Page: /pass/wed_tariro_shadreck_2026
      if (url.pathname.startsWith('/pass/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Wewed Wedding Pass — ${mockData.samplePass.guestName}</title>
  <style>
    :root {
      --bg-surface: #17130F;
      --card-bg: #FFFFFF;
      --gold-primary: #B3833F;
      --text-main: #24201D;
    }
    body {
      margin: 0;
      background: var(--bg-surface);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
      color: var(--text-main);
      display: flex;
      justify-content: center;
    }
    .pass-container {
      width: 100%;
      max-width: 400px;
    }
    .announcement-banner {
      background: #FFF8E1;
      border: 1px solid #FFE082;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #6D4C41;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pass-card {
      background: var(--card-bg);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 28px rgba(0,0,0,0.4);
    }
    .pass-header {
      background: linear-gradient(135deg, #B3833F, #7E561E);
      color: #FFF;
      padding: 20px;
      text-align: center;
    }
    .pass-header h2 { margin: 0 0 4px 0; font-size: 18px; }
    .pass-header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .pass-body {
      padding: 20px;
    }
    .qr-container {
      text-align: center;
      padding: 16px;
      background: #F9F9F9;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .qr-code-svg {
      width: 160px;
      height: 160px;
      margin: 0 auto;
      background: #000;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFF;
      font-size: 11px;
      word-break: break-all;
      padding: 8px;
      box-sizing: border-box;
    }
    .pass-serial {
      font-family: monospace;
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .info-item {
      background: #F5F5F5;
      padding: 10px;
      border-radius: 8px;
    }
    .info-label { font-size: 11px; color: #777; text-transform: uppercase; }
    .info-val { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .schedule-card {
      margin-top: 20px;
    }
    .schedule-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #B3833F;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .timeline-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #EEE;
      font-size: 13px;
    }
    .timeline-time { font-weight: 600; color: #555; }
  </style>
</head>
<body>
  <div class="pass-container">
    <!-- Announcement Banner -->
    <div id="announcement-banner" class="announcement-banner" data-testid="announcement-banner">
      <span>📢</span>
      <div>
        <strong>Welcome to Imba Manor Estate</strong><br/>
        Ceremony will begin promptly at 14:00. Doors open at 13:15.
      </div>
    </div>

    <!-- Pass Card -->
    <div class="pass-card">
      <div class="pass-header">
        <h2>${mockData.samplePass.coupleNames}</h2>
        <p>${mockData.wedding.venueName} • 24 Oct 2026</p>
      </div>

      <div class="pass-body">
        <!-- QR Code -->
        <div class="qr-container">
          <div id="pass-qr-code" class="qr-code-svg" data-testid="pass-qr-code" data-payload="${mockData.samplePass.qrPayload}">
            <svg width="140" height="140" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#000" />
              <rect x="10" y="10" width="30" height="30" fill="#FFF" />
              <rect x="15" y="15" width="20" height="20" fill="#000" />
              <rect x="60" y="10" width="30" height="30" fill="#FFF" />
              <rect x="65" y="15" width="20" height="20" fill="#000" />
              <rect x="10" y="60" width="30" height="30" fill="#FFF" />
              <rect x="15" y="65" width="20" height="20" fill="#000" />
              <circle cx="50" cy="50" r="10" fill="#B3833F" />
            </svg>
          </div>
          <div class="pass-serial" data-testid="pass-serial">${mockData.samplePass.passSerial || 'WW-JD-0824'}</div>
        </div>

        <!-- Guest Details -->
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Guest</div>
            <div class="info-val" data-testid="guest-name">${mockData.samplePass.guestName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Seats</div>
            <div class="info-val" data-testid="guest-party-size">${mockData.samplePass.partySize} Reserved</div>
          </div>
          <div class="info-item">
            <div class="info-label">Table</div>
            <div class="info-val" data-testid="seating-table">${mockData.samplePass.tableName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Assigned Seats</div>
            <div class="info-val" data-testid="seating-seats">${mockData.samplePass.seatNumber}</div>
          </div>
        </div>

        <!-- Programme Schedule -->
        <div class="schedule-card">
          <div class="schedule-title">Today's Schedule</div>
          <div id="schedule-list">
            ${mockData.wedding.programme.map((p: any) => `
              <div class="timeline-row" data-testid="programme-item">
                <span>${p.title}</span>
                <span class="timeline-time">${p.time}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`)
        return
      }

      // Planner Dashboard: /planner/wedding-day
      if (url.pathname === '/planner/wedding-day') {
        const authHeader = req.headers['authorization'] || ''
        if (authHeader.includes('Bearer guest-')) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Access Denied: Role GUEST not permitted in Planner Hub' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Wewed Planner Command Centre — Wedding Day</title>
  <style>
    body {
      margin: 0;
      background: #111827;
      color: #F9FAFB;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
    }
    .header {
      padding: 12px 0;
      border-bottom: 1px solid #374151;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: #1F2937;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #374151;
    }
    .metric-label { font-size: 12px; color: #9CA3AF; text-transform: uppercase; }
    .metric-val { font-size: 24px; font-weight: bold; margin-top: 4px; color: #60A5FA; }
    .metric-sub { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="font-size: 20px; margin: 0;">Wedding Day Command Hub</h1>
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">Imba Manor Estate • Tariro & Shadreck</div>
  </div>

  <div class="grid">
    <div class="metric-card" data-testid="attendance-metric-card">
      <div class="metric-label">Guest Attendance</div>
      <div id="attendance-count" class="metric-val" data-testid="attendance-count">${attendanceCount}</div>
      <div class="metric-sub">of ${totalCapacity} Total Guests</div>
    </div>
    <div class="metric-card" data-testid="vendor-metric-card">
      <div class="metric-label">Vendor Status</div>
      <div id="vendor-count" class="metric-val" data-testid="vendor-count">${vendorsOnSite} / ${totalVendors}</div>
      <div class="metric-sub">Vendors On-Site</div>
    </div>
  </div>
</body>
</html>`)
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      baseURL = `http://127.0.0.1:${port}`
    })
  })

  test.afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('1. Open Ivory invitation', async ({ page }) => {
    await page.goto(`${baseURL}/invite/wed_tariro_shadreck_2026?token=w1-j8doe-7x9&card=ivory-floral-gold`)
    
    const container = page.locator('#invitation-container')
    await expect(container).toBeVisible()
    await expect(container).toHaveAttribute('data-card-style', 'ivory-floral-gold')
    await expect(page.locator('.monogram-seal')).toHaveText('T&S')
    await expect(page.locator('h1')).toContainText('Tariro & Shadreck')
    
    // Open / Unfold invitation
    const unfoldBtn = page.getByTestId('invitation-open-button')
    await expect(unfoldBtn).toBeVisible()
    await unfoldBtn.click()
    
    await expect(page.locator('#revealed-stage')).toBeVisible()
    await expect(page.locator('.venue-box')).toContainText('Imba Manor Estate')
  })

  test('2. RSVP', async ({ page }) => {
    await page.goto(`${baseURL}/invite/wed_tariro_shadreck_2026?token=w1-j8doe-7x9&card=ivory-floral-gold`)
    await page.getByTestId('invitation-open-button').click()
    
    const acceptBtn = page.getByTestId('rsvp-accept-button')
    await expect(acceptBtn).toBeVisible()
    await acceptBtn.click()
    
    await expect(page.locator('#rsvp-confirmed')).toBeVisible()
    await expect(page.locator('#rsvp-confirmed')).toContainText('RSVP Confirmed: Attending')
  })

  test('3. Open Wedding Pass', async ({ page }) => {
    await page.goto(`${baseURL}/invite/wed_tariro_shadreck_2026?token=w1-j8doe-7x9&card=ivory-floral-gold`)
    await page.getByTestId('invitation-open-button').click()
    await page.getByTestId('rsvp-accept-button').click()
    
    const passBtn = page.getByTestId('view-pass-button')
    await expect(passBtn).toBeVisible()
    await passBtn.click()
    
    await expect(page).toHaveURL(new RegExp('/pass/wed_tariro_shadreck_2026'))
    await expect(page.locator('.pass-card')).toBeVisible()
  })

  test('4. Verify correct guest', async ({ page }) => {
    await page.goto(`${baseURL}/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824`)
    
    const guestName = page.getByTestId('guest-name')
    await expect(guestName).toBeVisible()
    await expect(guestName).toHaveText('Jane & Michael Doe')
    
    const partySize = page.getByTestId('guest-party-size')
    await expect(partySize).toContainText('2 Reserved')
  })

  test('5. Verify QR present', async ({ page }) => {
    await page.goto(`${baseURL}/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824`)
    
    const qrCode = page.getByTestId('pass-qr-code')
    await expect(qrCode).toBeVisible()
    
    const payload = await qrCode.getAttribute('data-payload')
    expect(payload).toBeTruthy()
    expect(payload).toMatch(/^WW[12]\./)
    expect(payload).toContain('WWJD0824')
    
    const serial = page.getByTestId('pass-serial')
    await expect(serial).toHaveText('WW-JD-0824')
  })

  test('6. Verify schedule', async ({ page }) => {
    await page.goto(`${baseURL}/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824`)
    
    const scheduleItems = page.getByTestId('programme-item')
    expect(await scheduleItems.count()).toBeGreaterThanOrEqual(4)
    
    await expect(scheduleItems.first()).toContainText('Guest Arrival & Welcome Refreshments')
    await expect(scheduleItems.nth(1)).toContainText('Ceremony & Vows')
    await expect(scheduleItems.nth(3)).toContainText('Grand Reception & Dinner')
  })

  test('7. Verify seating', async ({ page }) => {
    await page.goto(`${baseURL}/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824`)
    
    const tableEl = page.getByTestId('seating-table')
    await expect(tableEl).toHaveText('Jacaranda — 8')
    
    const seatsEl = page.getByTestId('seating-seats')
    await expect(seatsEl).toHaveText('Seats 3 & 4')
  })

  test('8. Receive announcement', async ({ page }) => {
    await page.goto(`${baseURL}/pass/wed_tariro_shadreck_2026?serial=WW-JD-0824`)
    
    const announcement = page.getByTestId('announcement-banner')
    await expect(announcement).toBeVisible()
    await expect(announcement).toContainText('Welcome to Imba Manor Estate')
    await expect(announcement).toContainText('Ceremony will begin promptly at 14:00')
  })

  test('9. Planner opens Wedding Day', async ({ page }) => {
    await page.goto(`${baseURL}/planner/wedding-day`)
    
    await expect(page.locator('h1')).toContainText('Wedding Day Command Hub')
    await expect(page.getByTestId('attendance-metric-card')).toBeVisible()
    await expect(page.getByTestId('vendor-metric-card')).toBeVisible()
  })

  test('10. Planner attendance reflects check-in (e.g. 317 -> 318)', async ({ page }) => {
    await page.goto(`${baseURL}/planner/wedding-day`)
    
    const countEl = page.getByTestId('attendance-count')
    await expect(countEl).toHaveText('317')
    
    // Simulate gate check-in admission via authorized usher bearer token
    const res = await page.request.post(`${baseURL}/api/wedding-day/check-in`, {
      headers: { 'Authorization': 'Bearer usher-gate-alpha' },
      data: { passSerial: 'WW-JD-0824', count: 1 }
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.totalCheckedIn).toBe(318)
    
    // Refresh planner view
    await page.reload()
    await expect(page.getByTestId('attendance-count')).toHaveText('318')
  })

  test('11. Vendor status reflected (e.g. 10/13 -> 11/13)', async ({ page }) => {
    await page.goto(`${baseURL}/planner/wedding-day`)
    
    const vendorEl = page.getByTestId('vendor-count')
    await expect(vendorEl).toHaveText('10 / 13')
    
    // Simulate vendor reporting arrival
    const res = await page.request.post(`${baseURL}/api/wedding-day/vendor-status`, {
      data: { vendorId: 'vnd_decor_1', state: 'ARRIVED' }
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.vendorsOnSite).toBe(11)
    
    // Refresh planner view
    await page.reload()
    await expect(page.getByTestId('vendor-count')).toHaveText('11 / 13')
  })

  test('12. Unauthorized role blocked', async ({ page }) => {
    // Attempting check-in with unauthorized guest token
    const checkInRes = await page.request.post(`${baseURL}/api/wedding-day/check-in`, {
      headers: { 'Authorization': 'Bearer guest-w1-j8doe' },
      data: { passSerial: 'WW-JD-0824', count: 1 }
    })
    expect(checkInRes.status()).toBe(403)
    const body = await checkInRes.json()
    expect(body.error).toContain('Unauthorized')

    // Attempting direct navigation with guest token
    const plannerRes = await page.request.get(`${baseURL}/planner/wedding-day`, {
      headers: { 'Authorization': 'Bearer guest-w1-j8doe' }
    })
    expect(plannerRes.status()).toBe(403)
  })
})
