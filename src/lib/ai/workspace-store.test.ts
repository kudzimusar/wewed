import { describe, expect, test } from 'bun:test'
import { extractTemplateItems } from '@/lib/ai/workspace-store'
import {
  GUEST_ACCESSIBLE_PRIVACY,
  formatRetrievedSources,
} from '@/lib/ai/workspace-context'

const TASK_TEMPLATE = `
## Draft template

\`\`\`json
{
  "items": [
    {
      "type": "task",
      "title": "Confirm venue access window",
      "description": "Verify supplier access and loading times.",
      "category": "venue",
      "priority": "high",
      "offsetDays": -14
    },
    {
      "type": "timeline",
      "title": "Guest arrival",
      "time": "13:30",
      "duration": "30 min",
      "location": "Main entrance"
    },
    {
      "type": "reminder",
      "title": "RSVP follow-up",
      "subject": "Please confirm your attendance",
      "body": "Kindly respond before the deadline.",
      "audience": "pending",
      "offsetDays": -45
    }
  ]
}
\`\`\`
`

describe('AI template extraction', () => {
  test('extracts validated task, timeline and reminder items from fenced JSON', () => {
    const items = extractTemplateItems(TASK_TEMPLATE)

    expect(items).toHaveLength(3)
    expect(items[0]).toEqual({
      type: 'task',
      title: 'Confirm venue access window',
      description: 'Verify supplier access and loading times.',
      category: 'venue',
      priority: 'high',
      offsetDays: -14,
    })
    expect(items[1]?.type).toBe('timeline')
    expect(items[2]?.audience).toBe('pending')
  })

  test('drops invalid types and empty titles instead of creating unsafe writes', () => {
    const items = extractTemplateItems(
      JSON.stringify({
        items: [
          { type: 'delete_everything', title: 'Unsafe' },
          { type: 'task', title: '' },
          { type: 'task', title: 'Valid task', priority: 'urgent', offsetDays: 99999 },
        ],
      }),
    )

    expect(items).toEqual([
      {
        type: 'task',
        title: 'Valid task',
        offsetDays: 365,
      },
    ])
  })

  test('returns no structured actions for prose-only AI output', () => {
    expect(extractTemplateItems('Here is a useful checklist with no machine-readable block.')).toEqual([])
  })
})

describe('Guest-accessible wedding privacy', () => {
  test('supports current link-only wedding pages without exposing private weddings', () => {
    expect(GUEST_ACCESSIBLE_PRIVACY).toContain('link_only')
    expect(GUEST_ACCESSIBLE_PRIVACY).toContain('public')
    expect(GUEST_ACCESSIBLE_PRIVACY).not.toContain('private')
  })
})

describe('AI retrieval citations', () => {
  test('assigns deterministic source labels and requires inline citations', () => {
    const context = formatRetrievedSources([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        title: 'Venue manual',
        excerpt: 'Supplier access starts at 08:00.',
        sourceUrl: 'https://example.test/venue',
        visibility: 'private',
        score: 0.8,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        title: 'Catering proposal',
        excerpt: 'Final meal counts are due seven days before the wedding.',
        sourceUrl: null,
        visibility: 'private',
        score: 0.5,
      },
    ])

    expect(context).toContain('[S1] Venue manual (private)')
    expect(context).toContain('[S2] Catering proposal (private)')
    expect(context).toContain('cite it inline as [S1], [S2]')
  })

  test('adds no retrieval section when there are no authorised sources', () => {
    expect(formatRetrievedSources([])).toBe('')
  })
})
