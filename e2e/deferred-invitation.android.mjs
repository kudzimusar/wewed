import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { _android as android } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const EMULATOR_BASE_URL = process.env.WEWED_ANDROID_E2E_BASE_URL ?? 'http://10.0.2.2:3000'

async function createFixture() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const couple = await prisma.couple.create({
    data: {
      slug: `android-switch-couple-${suffix}`,
      partner1: 'Android',
      partner2: 'Switch',
    },
  })
  const wedding = await prisma.wedding.create({
    data: {
      slug: `android-switch-wedding-${suffix}`,
      title: 'Android Chrome Guest Switch Gate',
      date: new Date('2030-06-20T10:00:00.000Z'),
      venue: 'Wewed Android UAT Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      coupleId: couple.id,
    },
  })
  const guestA = await prisma.guest.create({
    data: {
      name: 'Android UAT Guest A',
      email: `android-a-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const guestB = await prisma.guest.create({
    data: {
      name: 'Android UAT Guest B',
      email: `android-b-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const tokenA = `android-a-${suffix}-${randomUUID().replaceAll('-', '')}`
  const tokenB = `android-b-${suffix}-${randomUUID().replaceAll('-', '')}`
  await prisma.rSVP.createMany({
    data: [
      { id: `${guestA.id}-rsvp`, token: tokenA, guestId: guestA.id },
      { id: `${guestB.id}-rsvp`, token: tokenB, guestId: guestB.id },
    ],
  })
  return {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    guestAId: guestA.id,
    guestBId: guestB.id,
    tokenA,
    tokenB,
  }
}

async function cleanupFixture(fixture) {
  if (!fixture) return
  await prisma.auditEvent.deleteMany({ where: { weddingId: fixture.weddingId } })
  await prisma.$executeRawUnsafe(
    'DELETE FROM private."InvitationInstallHandoff" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  await prisma.rSVP.deleteMany({
    where: { guestId: { in: [fixture.guestAId, fixture.guestBId] } },
  })
  await prisma.guest.deleteMany({
    where: { id: { in: [fixture.guestAId, fixture.guestBId] } },
  })
  await prisma.wedding.deleteMany({ where: { id: fixture.weddingId } })
  await prisma.couple.deleteMany({ where: { id: fixture.coupleId } })
}

async function poll(label, callback, { attempts = 40, delay = 250 } = {}) {
  let last
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await callback()
      if (value) return value
      last = value
    } catch (error) {
      last = error
    }
    await sleep(delay)
  }
  throw new Error(`Timed out waiting for ${label}: ${String(last ?? '')}`)
}

function handoffFromIntent(intentUrl) {
  assert.match(intentUrl, /^intent:\/\/invite\/resume#Intent;/)
  assert.ok(intentUrl.includes('scheme=wewed'))
  assert.ok(intentUrl.includes('package=pro.wewed.app'))
  assert.ok(!intentUrl.includes('rsvp='))
  assert.ok(!intentUrl.includes('guest='))
  assert.ok(!intentUrl.includes('email='))
  const match = intentUrl.match(/(?:^|;)S\.wewed_handoff=([^;]+);/)
  assert.ok(match, 'missing opaque handoff in Android intent')
  const handoff = decodeURIComponent(match[1])
  assert.match(handoff, /^[A-Za-z0-9_-]{43}$/)
  return handoff
}

async function activeGuestFromChrome(page, fixture) {
  const result = await page.evaluate(async ({ baseUrl, slug }) => {
    const response = await fetch(
      `${baseUrl}/api/weddings/${encodeURIComponent(slug)}/guest-session`,
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    )
    return {
      status: response.status,
      body: await response.json(),
    }
  }, { baseUrl: EMULATOR_BASE_URL, slug: fixture.weddingSlug })

  assert.equal(result.status, 200)
  return result.body
}

async function foregroundAndroidChrome(device, page) {
  // Match the manual UAT sequence: after Wewed/TWA is foregrounded, the user
  // explicitly returns to Android Chrome before opening the next guest link.
  // CDP can otherwise drive a background Chrome tab without giving Android a
  // foreground activity from which to dispatch a second external-app intent.
  await device.shell(
    'am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.android.chrome/com.google.android.apps.chrome.Main',
  )
  await sleep(500)
  await page.bringToFront()
  await sleep(250)
  console.log('checkpoint=android_chrome_foreground')
}

async function prepareGate(browserPage, fixture, token, handoffPostCount) {
  await browserPage.goto(
    `${EMULATOR_BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
    { waitUntil: 'domcontentloaded' },
  )

  const direct = browserPage.getByTestId('android-open-installed-wewed')
  const fallback = browserPage.getByTestId('android-open-existing-wewed')
  const link = await poll('prepared Android intent link', async () => {
    if (await direct.isVisible().catch(() => false)) return direct
    if (await fallback.isVisible().catch(() => false)) return fallback
    return null
  })

  const href = await link.getAttribute('href')
  assert.ok(href)
  const handoff = handoffFromIntent(href)

  return {
    link,
    handoff,
    postsBeforeClick: handoffPostCount(),
  }
}

async function clickPreparedGate(prepared, handoffPostCount) {
  // Preserve a genuine Chrome user gesture. Playwright may keep waiting for
  // the source page's scheduled navigation after Android has already handed
  // the intent to Wewed, so a short navigation timeout is expected here. The
  // authoritative success criteria are the native + server checkpoints below.
  try {
    await prepared.link.click({ timeout: 5_000 })
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error
    console.log('checkpoint=source_chrome_navigation_wait_released')
  }

  await sleep(750)
  assert.equal(
    handoffPostCount(),
    prepared.postsBeforeClick,
    'final Android launch click must not perform an async handoff POST',
  )
}

async function nativeCheckpoints(device, minimumIntentCount) {
  const state = await poll(
    `native invitation checkpoint #${minimumIntentCount}`,
    async () => {
      const xml = String(
        await device.shell(
          'run-as pro.wewed.app cat shared_prefs/wewed_invitation_checkpoints.xml',
        ),
      )
      const countMatch = xml.match(
        /<int name="native_intent_count" value="(\d+)"\s*\/>/,
      )
      const hostMatch = xml.match(
        /<string name="last_resume_host">([^<]+)<\/string>/,
      )
      const pathMatch = xml.match(
        /<string name="last_resume_path">([^<]+)<\/string>/,
      )
      const intentCount = Number.parseInt(countMatch?.[1] ?? '0', 10)
      if (
        intentCount >= minimumIntentCount &&
        hostMatch?.[1] === '10.0.2.2' &&
        pathMatch?.[1] === '/invite/resume'
      ) {
        return {
          intentCount,
          host: hostMatch[1],
          path: pathMatch[1],
        }
      }
      return null
    },
    { attempts: 80, delay: 250 },
  )

  console.log(`checkpoint=native_intent_received count=${state.intentCount}`)
  console.log(
    `checkpoint=native_resume_uri_ready host=${state.host} path=${state.path}`,
  )
}

async function assertVisibleGuestInvitation(browserContext, fixture, guestName) {
  const appPage = await poll(
    `Wewed invitation page for ${guestName}`,
    async () => {
      for (const page of browserContext.pages()) {
        try {
          const url = new URL(page.url())
          if (url.pathname !== `/w/${fixture.weddingSlug}`) continue
          const experience = page.getByTestId('premium-invitation-experience')
          if (!(await experience.isVisible().catch(() => false))) continue
          return page
        } catch {
          // Ignore transient about:blank / internal targets.
        }
      }
      return null
    },
    { attempts: 80, delay: 250 },
  )

  const experience = appPage.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await poll(
    `Ivory Floral Gold artwork for ${guestName}`,
    async () => (await card.getAttribute('data-artwork-ready')) === 'true',
    { attempts: 40, delay: 250 },
  )

  const openButton = experience.getByTestId('invitation-open-button')
  if (await openButton.isVisible().catch(() => false)) {
    await openButton.click()
  }

  await poll(
    `guest personalization ${guestName}`,
    async () => {
      const text = await experience
        .getByTestId('invitation-guest-personalization')
        .innerText()
        .catch(() => '')
      return text.includes(guestName)
    },
    { attempts: 40, delay: 250 },
  )

  const detailsButton = experience.getByTestId('invitation-details-button')
  if (await detailsButton.isVisible().catch(() => false)) {
    await detailsButton.click()
  }

  const rsvpButton = experience.getByTestId('invitation-cta-rsvp')
  await poll(
    `RSVP CTA for ${guestName}`,
    () => rsvpButton.isVisible().catch(() => false),
    { attempts: 40, delay: 250 },
  )
  await rsvpButton.click()

  const dialog = appPage.getByTestId('premium-invitation-rsvp-dialog')
  await poll(
    `RSVP dialog for ${guestName}`,
    async () => {
      if (!(await dialog.isVisible().catch(() => false))) return false
      return (await dialog.innerText().catch(() => '')).includes(guestName)
    },
    { attempts: 40, delay: 250 },
  )

  console.log(`checkpoint=visible_guest=${guestName}`)
  return appPage
}

async function waitForRedemption(fixture, minimumCount) {
  return poll('handoff redemption audit', async () => {
    const count = await prisma.auditEvent.count({
      where: {
        weddingId: fixture.weddingId,
        action: 'invitation_handoff_redeemed',
      },
    })
    return count >= minimumCount ? count : null
  }, { attempts: 60, delay: 250 })
}

async function run() {
  let fixture
  let browserContext
  let device

  try {
    fixture = await createFixture()

    const devices = await android.devices()
    assert.equal(devices.length, 1, `expected one Android device, found ${devices.length}`)
    device = devices[0]

    await device.shell('logcat -c')
    browserContext = await device.launchBrowser()
    const pages = browserContext.pages()
    const browserPage = pages[0] ?? await browserContext.newPage()

    let handoffPosts = 0
    browserPage.on('request', (request) => {
      try {
        if (
          request.method() === 'POST' &&
          new URL(request.url()).pathname === '/api/invitations/install-handoff'
        ) {
          handoffPosts += 1
          console.log('checkpoint=handoff_created')
        }
      } catch {
        // Ignore non-HTTP browser-internal requests.
      }
    })

    // A: real Android Chrome -> prepared intent -> Wewed wrapper -> local resume.
    await foregroundAndroidChrome(device, browserPage)
    const preparedA = await prepareGate(
      browserPage,
      fixture,
      fixture.tokenA,
      () => handoffPosts,
    )
    assert.equal(handoffPosts, 1)
    await clickPreparedGate(preparedA, () => handoffPosts)
    await nativeCheckpoints(device, 1)
    await waitForRedemption(fixture, 1)
    console.log('checkpoint=resume_requested guest=A')
    console.log('checkpoint=handoff_redeemed guest=A')

    const activeA = await activeGuestFromChrome(browserPage, fixture)
    assert.equal(activeA.guest.id, fixture.guestAId)
    assert.equal(activeA.guest.name, 'Android UAT Guest A')
    console.log('checkpoint=active_guest=A')
    await assertVisibleGuestInvitation(
      browserContext,
      fixture,
      'Android UAT Guest A',
    )

    // B must be fully prepared while A remains valid; the switch is committed
    // only after the Android intent is received and B redeems its handoff.
    await foregroundAndroidChrome(device, browserPage)
    const preparedB = await prepareGate(
      browserPage,
      fixture,
      fixture.tokenB,
      () => handoffPosts,
    )
    assert.equal(handoffPosts, 2)

    const beforeB = await activeGuestFromChrome(browserPage, fixture)
    assert.equal(beforeB.guest.id, fixture.guestAId)
    console.log('checkpoint=active_guest=A-before-B-resume')

    await clickPreparedGate(preparedB, () => handoffPosts)
    await nativeCheckpoints(device, 2)
    await waitForRedemption(fixture, 2)
    console.log('checkpoint=resume_requested guest=B')
    console.log('checkpoint=handoff_redeemed guest=B')

    const activeB = await activeGuestFromChrome(browserPage, fixture)
    assert.equal(activeB.guest.id, fixture.guestBId)
    assert.equal(activeB.guest.name, 'Android UAT Guest B')
    console.log('checkpoint=active_guest=B')
    await assertVisibleGuestInvitation(
      browserContext,
      fixture,
      'Android UAT Guest B',
    )

    // Reverse B -> A through the same Android Chrome profile and installed app.
    await foregroundAndroidChrome(device, browserPage)
    const preparedA2 = await prepareGate(
      browserPage,
      fixture,
      fixture.tokenA,
      () => handoffPosts,
    )
    assert.equal(handoffPosts, 3)

    const beforeA2 = await activeGuestFromChrome(browserPage, fixture)
    assert.equal(beforeA2.guest.id, fixture.guestBId)
    console.log('checkpoint=active_guest=B-before-A-resume')

    await clickPreparedGate(preparedA2, () => handoffPosts)
    await nativeCheckpoints(device, 3)
    await waitForRedemption(fixture, 3)
    console.log('checkpoint=resume_requested guest=A2')
    console.log('checkpoint=handoff_redeemed guest=A2')

    const activeA2 = await activeGuestFromChrome(browserPage, fixture)
    assert.equal(activeA2.guest.id, fixture.guestAId)
    assert.equal(activeA2.guest.name, 'Android UAT Guest A')
    console.log('checkpoint=active_guest=A-restored')
    await assertVisibleGuestInvitation(
      browserContext,
      fixture,
      'Android UAT Guest A',
    )

    assert.equal(
      handoffPosts,
      3,
      'one prepared handoff must be created per explicit guest switch',
    )
  } finally {
    if (device) {
      try {
        const logs = String(
          await device.shell('logcat -d -s WewedInvitation:I WewedInvitation:W *:S'),
        )
        if (logs.trim()) {
          console.log('checkpoint_log_begin')
          console.log(logs.trim())
          console.log('checkpoint_log_end')
        }
      } catch {
        // The emulator runner may already be tearing the device down.
      }
    }
    await browserContext?.close().catch(() => undefined)
    await device?.close().catch(() => undefined)
    await cleanupFixture(fixture)
    await prisma.$disconnect()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
