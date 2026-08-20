const MAX_RECALL_TERMS = 8

const RECALL_STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is',
  'it', 'me', 'my', 'of', 'on', 'or', 'our', 'please', 'tell', 'that', 'the', 'their', 'them',
  'there', 'these', 'they', 'this', 'to', 'us', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
])

const RECALL_VARIANTS: Record<string, string[]> = {
  decide: ['decide', 'decided', 'decision', 'decisions'],
  decided: ['decided', 'decide', 'decision', 'decisions'],
  decision: ['decision', 'decisions', 'decide', 'decided'],
  decisions: ['decisions', 'decision', 'decide', 'decided'],
  approve: ['approve', 'approved', 'approval'],
  approved: ['approved', 'approve', 'approval'],
  approval: ['approval', 'approve', 'approved'],
  pay: ['pay', 'paid', 'payment', 'payments'],
  paid: ['paid', 'pay', 'payment', 'payments'],
  payment: ['payment', 'payments', 'pay', 'paid'],
  payments: ['payments', 'payment', 'pay', 'paid'],
}

export interface NotebookRecallCandidate {
  title: string
  contentText: string
  updatedAt: Date
}

export function extractNotebookRecallTerms(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !RECALL_STOP_WORDS.has(token))

  const expanded: string[] = []
  for (const token of tokens) {
    for (const variant of RECALL_VARIANTS[token] ?? [token]) {
      if (!expanded.includes(variant)) expanded.push(variant)
      if (expanded.length >= MAX_RECALL_TERMS) return expanded
    }
  }
  return expanded
}

export function rankNotebookRecallCandidates<T extends NotebookRecallCandidate>(
  notes: T[],
  terms: string[],
): T[] {
  const scored = notes.map((note) => {
    const title = note.title.toLowerCase()
    const body = note.contentText.toLowerCase()
    const score = terms.reduce((total, term) => {
      const titleHit = title.includes(term) ? 4 : 0
      const bodyHit = body.includes(term) ? 1 : 0
      return total + titleHit + bodyHit
    }, 0)
    return { note, score }
  })

  return scored
    .sort((a, b) => b.score - a.score || b.note.updatedAt.getTime() - a.note.updatedAt.getTime())
    .map((entry) => entry.note)
}
