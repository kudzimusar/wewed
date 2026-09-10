import { expect, test, E2E_WEDDINGS } from './support/planner-browser'

const SESSION_COOKIE = 'wewed_admin_auth'

function nativeHeaders(sessionToken: string) {
  return {
    Authorization: `Bearer ${sessionToken}`,
    Accept: 'application/json',
    'x-wewed-client': 'native',
  }
}

test.describe('@mobile Native bearer transport', () => {
  test('authorizes the mobile session and ordinary planner permission boundary without cookies', async ({ plannerPage }) => {
    const context = plannerPage.context()
    const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE)

    expect(sessionCookie?.value, 'planner browser fixture must issue a signed Wewed app session').toBeTruthy()
    const sessionToken = sessionCookie!.value

    await context.clearCookies()
    expect((await context.cookies()).some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false)

    const withoutCredentials = await plannerPage.request.get('/api/mobile/auth/me')
    expect(withoutCredentials.status()).toBe(401)

    const mobileSession = await plannerPage.request.get('/api/mobile/auth/me', {
      headers: nativeHeaders(sessionToken),
    })
    expect(mobileSession.status()).toBe(200)
    expect(mobileSession.headers()['cache-control']).toContain('no-store')

    const mobilePayload = await mobileSession.json()
    expect(mobilePayload).toMatchObject({
      success: true,
      authorized: true,
      workspace: 'wedding',
      user: {
        role: 'planner',
        activeWeddingId: E2E_WEDDINGS.primary.id,
      },
      activeWedding: {
        id: E2E_WEDDINGS.primary.id,
        title: E2E_WEDDINGS.primary.title,
      },
    })
    expect(typeof mobilePayload.sessionToken).toBe('string')
    expect(mobilePayload.sessionToken.length).toBeGreaterThan(40)

    const plannerOverview = await plannerPage.request.get('/api/planner/overview', {
      headers: nativeHeaders(sessionToken),
    })
    expect(plannerOverview.status()).toBe(200)

    const overviewPayload = await plannerOverview.json()
    expect(overviewPayload).toMatchObject({
      success: true,
      wedding: {
        id: E2E_WEDDINGS.primary.id,
        title: E2E_WEDDINGS.primary.title,
      },
    })
    expect(overviewPayload.tasks.total).toBeGreaterThan(0)
    expect(overviewPayload.guests.total).toBeGreaterThan(0)

    const tamperedToken = `${sessionToken.slice(0, -1)}${sessionToken.endsWith('A') ? 'B' : 'A'}`
    const rejected = await plannerPage.request.get('/api/planner/overview', {
      headers: nativeHeaders(tamperedToken),
    })
    expect(rejected.status()).toBe(401)

    expect((await context.cookies()).some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false)
  })
})
