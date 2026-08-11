import { expect, test } from '@playwright/test'

const conversationId = '8ccb960a-b8da-45f1-a55c-f5cc5282a87b'
const coupleId = 'dfc1b4e1-6bec-434d-8c42-e26a145bfcaa'
const adminId = 'd8bfe2a5-a13d-4bfa-b26c-451f39b1ef9e'

function message(id: string, body: string, createdAt: string, senderUserId = adminId) {
  const coupleSender = senderUserId === coupleId
  return {
    id,
    conversationId,
    senderUserId,
    senderName: coupleSender ? 'Kudzanai Shadreck Musarurwa' : 'Wewed Administrator',
    senderRole: coupleSender ? 'couple' : 'admin',
    messageType: 'USER',
    visibility: 'PARTICIPANTS',
    body,
    replyToMessageId: null,
    createdAt,
    editedAt: null,
  }
}

test('@mobile Couple inbox opens one conversation at a time, follows latest, and respects history reading', async ({ page }) => {
  let includeFreshReply = false

  const history = [
    message('m01', 'Qualification message one with enough detail to make the mobile thread meaningfully scrollable.', '2026-08-10T23:17:24.640Z'),
    message('m02', 'Qualification message two with enough detail to preserve the original conversation history.', '2026-08-10T23:47:44.792Z'),
    message('m03', 'Couples contextual WhatsApp reply 2026-08-11', '2026-08-10T23:50:54.999Z', coupleId),
    message('m04', 'Earlier support context for the Couple message trail.', '2026-08-11T00:05:00.000Z'),
    message('m05', 'Another saved participant-visible message in this support conversation.', '2026-08-11T00:20:00.000Z'),
    message('m06', 'The mobile thread must keep older history available without opening at the top.', '2026-08-11T00:35:00.000Z'),
    message('m07', 'Additional history makes the bounded mobile message viewport scroll instead of expanding.', '2026-08-11T00:50:00.000Z'),
    message('m08', 'Testing new connection', '2026-08-11T03:01:57.828Z', coupleId),
  ]
  const freshReply = message(
    'm09',
    'Fresh WhatsApp trail after the reader deliberately opened older history',
    '2026-08-11T03:10:00.000Z',
    coupleId,
  )

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorized: true,
        user: {
          accessUserId: coupleId,
          displayName: 'Kudzanai Shadreck Musarurwa',
          email: 'couple@example.test',
          role: 'couple',
        },
      }),
    })
  })

  await page.route('**/api/communications/contacts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  await page.route('**/api/communications/conversations', async (route) => {
    const latest = includeFreshReply ? freshReply : history[history.length - 1]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          id: conversationId,
          kind: 'DIRECT',
          type: 'SUPPORT',
          title: 'Wewed Administrator',
          weddingId: null,
          status: 'OPEN',
          createdAt: '2026-08-10T23:10:00.000Z',
          lastMessageAt: latest.createdAt,
          lastMessageBody: latest.body,
          lastMessageSenderName: latest.senderName,
          lastReadAt: null,
          unreadCount: 1,
          participants: [
            { userId: coupleId, name: 'Kudzanai Shadreck Musarurwa', email: 'couple@example.test', role: 'couple' },
            { userId: adminId, name: 'Wewed Administrator', email: 'admin@example.test', role: 'admin' },
          ],
        }],
      }),
    })
  })

  await page.route(`**/api/communications/conversations/${conversationId}/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: includeFreshReply ? [...history, freshReply] : history }),
    })
  })

  await page.route(`**/api/communications/conversations/${conversationId}/read`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.goto('/messages')

  const inbox = page.locator('[data-communications-inbox="true"]')
  const conversation = page.locator('[data-communications-thread="true"]')
  const thread = page.locator('[data-communications-thread-scroll="true"]')

  await expect(inbox).toBeVisible()
  await expect(conversation).toBeHidden()
  await page.getByText('Wewed Administrator', { exact: true }).click()
  await expect(inbox).toBeHidden()
  await expect(conversation).toBeVisible()
  await expect(thread).toBeVisible()
  await expect(page.getByText('Testing new connection', { exact: true })).toBeVisible()

  await expect.poll(async () => thread.evaluate((element) => {
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
    return element.scrollHeight > element.clientHeight && remaining <= 2
  }), { message: 'newly opened Couple thread follows its latest rendered message' }).toBe(true)

  await thread.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  await expect.poll(async () => thread.evaluate((element) => element.scrollTop)).toBe(0)

  includeFreshReply = true
  await page.getByRole('button', { name: 'Refresh messages' }).click()
  await expect(page.getByText(freshReply.body, { exact: true })).toBeVisible()

  await expect.poll(async () => thread.evaluate((element) => element.scrollTop), {
    message: 'polling does not drag a reader away from deliberately opened history',
  }).toBe(0)

  await page.getByRole('button', { name: 'Back to inbox' }).click()
  await expect(inbox).toBeVisible()
  await expect(conversation).toBeHidden()
})
