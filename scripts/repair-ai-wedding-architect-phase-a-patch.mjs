import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/app/api/providers/profile/route.ts'
const source = readFileSync(path, 'utf8')
const marker = "export const dynamic = 'force-dynamic'\n"
const markerIndex = source.indexOf(marker)

if (markerIndex < 0) {
  throw new Error('Provider API endpoint marker was not found.')
}

const legitimateEnd = markerIndex + marker.length
const trailing = source.slice(legitimateEnd)
if (!trailing.trim()) {
  throw new Error('Provider API has no duplicate trailing artifact to remove.')
}

writeFileSync(path, source.slice(0, legitimateEnd))
console.log('Duplicate provider API patch artifact removed after legitimate endpoint.')
