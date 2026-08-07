import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/components/providers/provider-profile-manager.tsx'
let source = readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
  "import { PublicPlatformShell } from '@/components/public/public-platform-shell'\n",
  "import { PublicPlatformShell } from '@/components/public/public-platform-shell'\nimport { ProviderCommercialAiCoach } from '@/components/providers/provider-commercial-ai-coach'\n",
  'provider coach import',
)

replaceOnce(
  `        <div className="mt-4 grid gap-2 sm:grid-cols-2">\n          {recommendedPricing.map((recommended) => {\n            const added = !missingRecommendedPricing.includes(recommended)\n            return <div key={recommended.key} className={\`rounded-xl border p-3 text-xs ${'${added ? "border-sage/25 bg-sage/5" : "border-gold/15 bg-white"}'}\`}><div className="flex items-center justify-between gap-2"><strong>{recommended.label}</strong><span className="text-[10px] uppercase tracking-[0.12em] text-espresso/40">{recommended.priority}</span></div><p className="mt-1 leading-5 text-espresso/50">{recommended.help}</p>{recommended.unit && <p className="mt-1 text-[10px] text-gold-muted">Unit: {recommended.unit}</p>}</div>\n          })}\n        </div>\n      </div>`,
  `        <div className="mt-4 grid gap-2 sm:grid-cols-2">\n          {recommendedPricing.map((recommended) => {\n            const added = !missingRecommendedPricing.includes(recommended)\n            return <div key={recommended.key} className={\`rounded-xl border p-3 text-xs ${'${added ? "border-sage/25 bg-sage/5" : "border-gold/15 bg-white"}'}\`}><div className="flex items-center justify-between gap-2"><strong>{recommended.label}</strong><span className="text-[10px] uppercase tracking-[0.12em] text-espresso/40">{recommended.priority}</span></div><p className="mt-1 leading-5 text-espresso/50">{recommended.help}</p>{recommended.unit && <p className="mt-1 text-[10px] text-gold-muted">Unit: {recommended.unit}</p>}</div>\n          })}\n        </div>\n        <ProviderCommercialAiCoach\n          category={offering.category}\n          description={offering.description}\n          details={offering.details}\n          priceComponents={offering.priceComponents}\n          readinessMissing={offering.aiReadinessMissing}\n        />\n      </div>`,
  'provider coach placement',
)

writeFileSync(path, source)
console.log('Provider AI catalogue coach embedded in commercial form.')
