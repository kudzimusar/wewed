import { readFileSync, writeFileSync } from 'node:fs'

const path = 'scripts/apply-ai-wedding-architect-phase-a.mjs'
let source = readFileSync(path, 'utf8')

function replaceExactlyOnce(needle, replacement, label) {
  const count = source.split(needle).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  source = source.replace(needle, replacement)
}

const helperMarker = `function replaceRegexOnce(path, pattern, replacement) {`
const firstMatchHelper = `function replaceFirst(path, needle, replacement) {
  const current = read(path)
  if (!current.includes(needle)) {
    throw new Error(\`${'${path}'}: guarded first-match replacement did not find: ${'${needle.slice(0, 100)}'}\`)
  }
  write(path, current.replace(needle, replacement))
}

${helperMarker}`
replaceExactlyOnce(helperMarker, firstMatchHelper, 'first-match helper insertion')

const statusCall = `replaceOnce(
  api,
  "        const status = typeof input.status === 'string' && OFFERING_STATUS.has(input.status) ? input.status : 'draft'\\n        const offering = {\\n",
`
const statusCallReplacement = statusCall.replace('replaceOnce(', 'replaceFirst(')
replaceExactlyOnce(statusCall, statusCallReplacement, 'service offering status patch')

const publicMarker = "const publicComponent = 'src/components/providers/public-provider-profile.tsx'\n"
const importPatch = `${publicMarker}replaceOnce(
  publicComponent,
  "import { AlertTriangle, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Clock3, Globe2, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, Users } from 'lucide-react'\\n",
  "import { AlertTriangle, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Clock3, Globe2, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, Sparkles, Users } from 'lucide-react'\\n",
)
`
replaceExactlyOnce(publicMarker, importPatch, 'public AI-ready badge icon import')

writeFileSync(path, source)
console.log('Guarded Phase A integration script repaired.')
