const EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi

function unwrapEnvironmentValue(value: string): string {
  let candidate = value.trim()

  // Vercel's value field should contain only the value, but tolerate a copied
  // KEY=value assignment so one dashboard paste cannot take transactional mail down.
  candidate = candidate.replace(/^[A-Z][A-Z0-9_]*\s*=\s*/i, '').trim()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const first = candidate[0]
    const last = candidate[candidate.length - 1]
    if (candidate.length >= 2 && first === last && ['"', "'", '`'].includes(first)) {
      candidate = candidate.slice(1, -1).trim()
      continue
    }
    break
  }

  return candidate
}

export function normalizeMailboxEnvironmentValue(
  value: string | undefined,
  options: { preserveDisplayName?: boolean } = {},
): string | null {
  if (!value?.trim()) return null
  const candidate = unwrapEnvironmentValue(value)
  const matches = [...candidate.matchAll(EMAIL_PATTERN)]
  if (matches.length !== 1) return null

  const match = matches[0]
  const email = match[0]
  const index = match.index ?? -1
  if (index < 0) return null

  let before = candidate.slice(0, index).trim()
  const after = candidate.slice(index + email.length).trim()

  const hasOpeningBracket = before.endsWith('<')
  if (hasOpeningBracket) before = before.slice(0, -1).trim()
  if (after && !(hasOpeningBracket && after === '>')) return null
  if (!hasOpeningBracket && before) return null

  if (!options.preserveDisplayName || !before) return email

  const displayName = before
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[\r\n<>]/g, '')
    .trim()
    .slice(0, 120)

  return displayName ? `${displayName} <${email}>` : email
}
