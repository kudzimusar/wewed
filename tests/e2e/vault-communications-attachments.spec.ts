import { expect, test } from '@playwright/test'

const conversationId = 'phase1-conversation'
const weddingId = 'phase1-wedding'
const coupleId = 'phase1-couple-user'
const adminId = 'phase1-admin-user'

test.use({ serviceWorkers: 'block' })

function attachment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'att-available',
    messageId: 'm-attachment',
    vaultObjectId: 'vault-available',
    filename: 'invoice.pdf',
    displayName: 'invoice.pdf',
    mimeType: 'application/pdf',
    byteSize: 27,
    caption: 'Supplier invoice',
    position: 0,
    state: 'available',
    createdAt: '2026-08-18T05:00:00.000Z',
    ...overrides,
  }
}

function message(id: string, body: string, attachments: unknown[] = []) {
  return {
    id,
    conversationId,
    senderUserId: adminId,
    senderName: 'Wewed Administrator',
    senderRole: 'admin',
    messageType: 'USER',
    visibility: 'PARTICIPANTS',
    body,
    replyToMessageId: null,
    createdAt: '2026-08-18T05:00:00.000Z',
    editedAt: null,
    attachments,
  }
}

async function mockMessagesFoundation(page: Parameters<typeof test>[0] extends never ? never : any) {
  await page.route('**/api/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorized: true,
        user: {
          accessUserId: coupleId,
          displayName: 'Phase One Couple',
          email: 'couple@example.test',
          role: 'couple',
        },
      }),
    })
  })
  await page.route('**/api/communications/contacts', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  })
  await page.route('**/api/communications/conversations', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          id: conversationId,
          kind: 'DIRECT',
          type: 'PLANNER_CLIENT',
          title: 'Wewed Administrator',
          weddingId,
          status: 'OPEN',
          createdAt: '2026-08-18T04:00:00.000Z',
          lastMessageAt: '2026-08-18T05:00:00.000Z',
          lastMessageBody: 'Private files are now governed.',
          lastMessageSenderName: 'Wewed Administrator',
          lastReadAt: null,
          unreadCount: 1,
          participants: [
            { userId: coupleId, name: 'Phase One Couple', email: 'couple@example.test', role: 'couple' },
            { userId: adminId, name: 'Wewed Administrator', email: 'admin@example.test', role: 'admin' },
          ],
        }],
      }),
    })
  })
  await page.route(`**/api/communications/conversations/${conversationId}/read`, async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

test('Phase 1 Messages renders governed attachments, uploads from the composer, and keeps quarantined files closed', async ({ page }) => {
  await mockMessagesFoundation(page)
  let attachmentUploads = 0
  let downloadCalls = 0
  let promotionCalls = 0

  await page.route(`**/api/communications/conversations/${conversationId}/messages`, async (route) => {
    const data = [
      message('m-attachment', 'Private files are now governed.', [
        attachment(),
        attachment({
          id: 'att-quarantined',
          vaultObjectId: 'vault-quarantined',
          filename: 'budget.xlsx',
          displayName: 'budget.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          caption: null,
          position: 1,
          state: 'quarantined',
        }),
      ]),
    ]
    if (attachmentUploads > 0) {
      data.push(message('m-uploaded', 'Shared proof.pdf', [attachment({
        id: 'att-uploaded',
        messageId: 'm-uploaded',
        vaultObjectId: 'vault-uploaded',
        filename: 'proof.pdf',
        displayName: 'proof.pdf',
        caption: 'Payment proof',
      })]))
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })

  await page.route(`**/api/communications/conversations/${conversationId}/attachments`, async (route) => {
    attachmentUploads += 1
    const postData = route.request().postDataBuffer()
    expect(postData?.includes(Buffer.from('%PDF-'))).toBe(true)
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { messageId: 'm-uploaded', attachments: [] } }),
    })
  })

  await page.route('**/api/communications/attachments/att-available', async (route) => {
    downloadCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { signedUrl: 'https://example.test/private-file', filename: 'invoice.pdf' } }),
    })
  })
  await page.route('https://example.test/private-file', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7 private' })
  })
  await page.route('**/api/communications/attachments/att-available/promote', async (route) => {
    promotionCalls += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })

  await page.goto('/messages')
  await page.getByText('Wewed Administrator', { exact: true }).first().click()

  await expect(page.getByText('invoice.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('Supplier invoice', { exact: true })).toBeVisible()
  await expect(page.getByText('budget.xlsx', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quarantined' })).toBeDisabled()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open securely' }).first().click()
  const popup = await popupPromise
  await popup.close()
  await expect.poll(() => downloadCalls).toBe(1)

  await page.getByRole('button', { name: 'Add to wedding documents' }).first().click()
  await expect.poll(() => promotionCalls).toBe(1)

  const composer = page.locator('[data-communications-attachment-composer="true"]')
  await composer.locator('input[type="file"]').setInputFiles({
    name: 'proof.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nphase-one-proof'),
  })
  await expect(page.getByText('proof.pdf', { exact: true })).toBeVisible()
  await composer.getByPlaceholder('Optional caption').fill('Payment proof')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect.poll(() => attachmentUploads).toBe(1)
  await expect(page.getByText('Payment proof', { exact: true })).toBeVisible()
  await expect(composer.locator('[data-communications-selected-files="true"]')).toHaveCount(0)
})

test('Phase 1 Vault lists private metadata, shows quarantine state, and uploads without destructive controls', async ({ page }) => {
  let uploads = 0
  let downloadCalls = 0

  await page.route('**/api/vault**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      uploads += 1
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'vault-new', displayName: 'new.pdf', available: true } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        context: { weddingId, role: 'couple', canUpload: true },
        data: [
          {
            id: 'vault-safe', displayName: 'agreement.pdf', originalFilename: 'agreement.pdf', mimeType: 'application/pdf', extension: 'pdf', byteSize: 1200,
            checksumSha256: 'a'.repeat(64), uploadSource: 'communication_attachment', storageState: 'stored_private', scanState: 'content_validated', sensitivity: 'private', publicationState: 'private', retentionClass: 'wedding_record', legalHold: false, category: 'wedding_document', createdAt: '2026-08-18T05:00:00.000Z', archivedAt: null, available: true,
            links: [{ id: 'link-1', entityType: 'wedding', entityId: weddingId, linkRole: 'wedding_document', createdAt: '2026-08-18T05:00:00.000Z' }],
          },
          {
            id: 'vault-quarantine', displayName: 'budget.xlsx', originalFilename: 'budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', byteSize: 900,
            checksumSha256: 'b'.repeat(64), uploadSource: 'notebook_attachment', storageState: 'quarantined', scanState: 'external_scan_required', sensitivity: 'private', publicationState: 'private', retentionClass: 'wedding_record', legalHold: false, category: 'planner_note', createdAt: '2026-08-18T05:01:00.000Z', archivedAt: null, available: false, links: [],
          },
        ],
      }),
    })
  })
  await page.route('**/api/vault/vault-safe', async (route) => {
    downloadCalls += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { signedUrl: 'https://example.test/vault-safe', filename: 'agreement.pdf' } }) })
  })
  await page.route('https://example.test/vault-safe', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7 vault' })
  })

  await page.goto('/vault')
  await expect(page.getByRole('heading', { name: 'Wewed Vault' })).toBeVisible()
  await expect(page.getByText('agreement.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('budget.xlsx', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quarantined' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0)

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open securely' }).click()
  const popup = await popupPromise
  await popup.close()
  await expect.poll(() => downloadCalls).toBe(1)

  await page.locator('#wewed-vault-upload').setInputFiles({
    name: 'new.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nnew-vault-file'),
  })
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect.poll(() => uploads).toBe(1)
})
