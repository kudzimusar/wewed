export function normalizePlannerTitle(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
}

export function plannerTitleError(value: unknown): string | null {
  const title = normalizePlannerTitle(value)
  if (!title) return 'Enter a task title.'
  if (!/[\p{L}\p{N}]/u.test(title)) {
    return 'Use at least one letter or number in the task title.'
  }
  return null
}
