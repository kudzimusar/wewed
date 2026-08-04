import { expect, openModule, test } from './support/planner-browser'

interface TimelineResponse {
  data: Array<{
    id: string
    time: string
    event: string
  }>
}

async function createTimelineItem(
  page: Parameters<typeof openModule>[0],
  time: string,
  event: string,
) {
  const response = await page.request.post('/api/planner/timeline', {
    data: {
      time,
      event,
      duration: '10 minutes',
      location: 'Chronology test location',
      notes: 'Automatic timeline ordering contract',
    },
  })
  expect(response.ok()).toBe(true)
}

async function timelineItemTop(
  page: Parameters<typeof openModule>[0],
  event: string,
): Promise<number> {
  const item = page.getByTestId('timeline-item').filter({ hasText: event })
  await expect(item).toHaveCount(1)
  const box = await item.boundingBox()
  expect(box).not.toBeNull()
  return box!.y
}

test('Timeline panels are ordered automatically by clock time', async ({ plannerPage: page }) => {
  const early = 'UAT-CHRONOLOGY-001 Early access'
  const middle = 'UAT-CHRONOLOGY-002 Midday handover'
  const late = 'UAT-CHRONOLOGY-003 Late closeout'

  // Deliberately create records in reverse chronological order. Their stored
  // append order must not control their presentation order.
  await createTimelineItem(page, '23:33', late)
  await createTimelineItem(page, '12:22', middle)
  await createTimelineItem(page, '06:11', early)

  await openModule(page, 'timeline')

  const earlyTop = await timelineItemTop(page, early)
  const middleTop = await timelineItemTop(page, middle)
  const lateTop = await timelineItemTop(page, late)
  expect(earlyTop).toBeLessThan(middleTop)
  expect(middleTop).toBeLessThan(lateTop)

  const payloadResponse = await page.request.get('/api/planner/timeline')
  expect(payloadResponse.ok()).toBe(true)
  const payload = (await payloadResponse.json()) as TimelineResponse
  const middleRecord = payload.data.find((item) => item.event === middle)
  expect(middleRecord).toBeDefined()

  const updateResponse = await page.request.patch(`/api/planner/timeline/${middleRecord!.id}`, {
    data: { time: '05:55' },
  })
  expect(updateResponse.ok()).toBe(true)

  await page.reload()
  await openModule(page, 'timeline')

  const movedTop = await timelineItemTop(page, middle)
  const previousEarlyTop = await timelineItemTop(page, early)
  expect(movedTop).toBeLessThan(previousEarlyTop)

  const movedCard = page.getByTestId('timeline-item').filter({ hasText: middle })
  await expect(movedCard).toHaveAttribute('data-timeline-time', '05:55')
  await expect(movedCard.getByRole('button', { name: `Move ${middle} up among events at 05:55` })).toBeDisabled()
  await expect(movedCard.getByRole('button', { name: `Move ${middle} down among events at 05:55` })).toBeDisabled()
})

test('Timeline API rejects impossible clock values', async ({ plannerPage: page }) => {
  const response = await page.request.post('/api/planner/timeline', {
    data: {
      time: '25:90',
      event: 'UAT-CHRONOLOGY-INVALID Impossible time',
    },
  })
  expect(response.status()).toBe(400)
  await expect(response.json()).resolves.toMatchObject({
    error: 'Time must be a valid clock time.',
  })
})
