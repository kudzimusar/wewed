import { readFileSync, writeFileSync } from 'node:fs'

const path = 'scripts/apply-ai-wedding-architect-phase-a.mjs'
let source = readFileSync(path, 'utf8')

function replaceExactlyOnce(needle, replacement, label) {
  const count = source.split(needle).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  source = source.replace(needle, replacement)
}

const capacityLine = "        if (minimumCapacity !== null && maximumCapacity !== null && minimumCapacity > maximumCapacity) throw new Error('Minimum capacity cannot exceed maximum capacity.')\\n"
const statusLine = "        const status = typeof input.status === 'string' && OFFERING_STATUS.has(input.status) ? input.status : 'draft'\\n"
const offeringLine = "        const offering = {\\n"

replaceExactlyOnce(
  `  ${JSON.stringify(statusLine + offeringLine)},\n  ${JSON.stringify(statusLine + "        const pricingVisibility = typeof input.pricingVisibility === 'string' && PRICING_VISIBILITY.has(input.pricingVisibility) ? input.pricingVisibility : 'quote_only'\\n")}`,
  `  ${JSON.stringify(capacityLine + statusLine + offeringLine)},\n  ${JSON.stringify(capacityLine + statusLine + "        const pricingVisibility = typeof input.pricingVisibility === 'string' && PRICING_VISIBILITY.has(input.pricingVisibility) ? input.pricingVisibility : 'quote_only'\\n")}`,
  'service offering status patch',
)

const publicMarker = "const publicComponent = 'src/components/providers/public-provider-profile.tsx'\n"
const importPatch = `${publicMarker}replaceOnce(\n  publicComponent,\n  \"import { AlertTriangle, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Clock3, Globe2, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, Users } from 'lucide-react'\\n\",\n  \"import { AlertTriangle, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Clock3, Globe2, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, Sparkles, Users } from 'lucide-react'\\n\",\n)\n`
replaceExactlyOnce(publicMarker, importPatch, 'public AI-ready badge icon import')

writeFileSync(path, source)
console.log('Guarded Phase A integration script repaired.')
