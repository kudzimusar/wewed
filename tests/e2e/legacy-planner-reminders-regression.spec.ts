import { expect, test } from './support/planner-browser'

test('legacy Planner RSVP email reminders remain CRUD-safe with preview delivery', async ({ plannerPage: page }) => {
  const initial = await page.request.get('/api/planner/reminders')
  expect(initial.ok()).toBe(true)
  const initialPayload = await initial.json()
  expect(initialPayload.success).toBe(true)
  expect(initialPayload.data).toEqual([])

  const createdResponse = await page.request.post('/api/planner/reminders', {
    data: {
      name: 'RSVP follow-up',
      subject: 'Hello {{guest_name}} — RSVP for {{wedding_title}}',
      body: 'Please confirm by visiting {{rsvp_link}}.',
      audience: 'attending',
      status: 'draft',
    },
  })
  expect(createdResponse.status()).toBe(201)
  const createdPayload = await createdResponse.json()
  expect(createdPayload.success).toBe(true)
  expect(createdPayload.data.name).toBe('RSVP follow-up')
  expect(createdPayload.data.channel).toBe('email')
  const reminderId = createdPayload.data.id as string

  const previewResponse = await page.request.post('/api/planner/reminders/send', {
    data: { id: reminderId, dryRun: true },
  })
  expect(previewResponse.ok()).toBe(true)
  const previewPayload = await previewResponse.json()
  expect(previewPayload.success).toBe(true)
  expect(previewPayload.dryRun).toBe(true)
  expect(previewPayload.recipientCount).toBe(1)
  expect(previewPayload.recipients[0].subject).toContain('Primary Test Guest')
  expect(previewPayload.recipients[0].invitationUrl).toContain('/invite/')

  const updatedResponse = await page.request.patch('/api/planner/reminders', {
    data: {
      id: reminderId,
      name: 'RSVP final follow-up',
      subject: 'Final RSVP reminder for {{wedding_title}}',
      body: 'Use your private invitation: {{digital_invitation_url}}',
      audience: 'all',
      status: 'scheduled',
      scheduledFor: '2027-01-20T08:00:00.000Z',
    },
  })
  expect(updatedResponse.ok()).toBe(true)
  const updatedPayload = await updatedResponse.json()
  expect(updatedPayload.data.name).toBe('RSVP final follow-up')
  expect(updatedPayload.data.status).toBe('scheduled')
  expect(updatedPayload.data.scheduledFor).toBe('2027-01-20T08:00:00.000Z')

  const listed = await page.request.get('/api/planner/reminders')
  expect(listed.ok()).toBe(true)
  const listedPayload = await listed.json()
  expect(listedPayload.data).toHaveLength(1)
  expect(listedPayload.data[0].id).toBe(reminderId)

  const cancelled = await page.request.delete('/api/planner/reminders', {
    data: { id: reminderId },
  })
  expect(cancelled.ok()).toBe(true)
  const cancelledPayload = await cancelled.json()
  expect(cancelledPayload.data.status).toBe('cancelled')

  const cancelledPreview = await page.request.post('/api/planner/reminders/send', {
    data: { id: reminderId, dryRun: true },
  })
  expect(cancelledPreview.status()).toBe(409)
})
