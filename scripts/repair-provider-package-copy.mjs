import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/components/providers/provider-profile-manager.tsx'
const source = readFileSync(path, 'utf8')
const before = 'Packages are calculation-ready catalogue products: include quantities, overage pricing, exclusions, add-ons and validity.'
const after = 'Add structured packages so couples and Wewed AI can compare real inclusions, quantities, overage pricing, exclusions, add-ons and price validity.'
const count = source.split(before).length - 1
if (count !== 1) throw new Error(`Expected one package helper copy match, found ${count}.`)
writeFileSync(path, source.replace(before, after))
