import { describe, expect, test } from 'bun:test'
import { extractNotebookRecallTerms, rankNotebookRecallCandidates } from './recall-query'

describe('Notebook natural-language recall', () => {
  test('does not treat a whole conversational question as one required search phrase', () => {
    const terms = extractNotebookRecallTerms('What did we decide about chairs?')
    expect(terms).toContain('chairs')
    expect(terms).toContain('decision')
    expect(terms).not.toContain('what')
    expect(terms).not.toContain('about')
  })

  test('expands common planning-state wording without inventing source facts', () => {
    expect(extractNotebookRecallTerms('Was the vendor payment approved?')).toEqual(
      expect.arrayContaining(['vendor', 'payment', 'payments', 'pay', 'paid', 'approved', 'approval']),
    )
  })

  test('ranks a directly matching authorized source ahead of an unrelated recent note', () => {
    const now = Date.now()
    const ranked = rankNotebookRecallCandidates([
      {
        title: 'Unrelated recent note',
        contentText: 'The cake tasting is next week.',
        updatedAt: new Date(now),
      },
      {
        title: 'Meeting with Tony - Budget',
        contentText: 'Decisions: APPROVED: Hiring the chairs at the quoted cost of $460.',
        updatedAt: new Date(now - 60_000),
      },
    ], extractNotebookRecallTerms('What did we decide about chairs?'))

    expect(ranked[0]?.title).toBe('Meeting with Tony - Budget')
  })
})
