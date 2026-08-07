import { readFileSync, writeFileSync } from 'node:fs'

const path = 'scripts/apply-ai-wedding-architect-phase-a.mjs'
let source = readFileSync(path, 'utf8')

const oldHelper = `function replaceOnce(path, needle, replacement) {
  const current = read(path)
  const occurrences = current.split(needle).length - 1
  if (occurrences !== 1) {
    throw new Error(\`${'${path}'}: expected exactly one match, found ${'${occurrences}'}: ${'${needle.slice(0, 100)}'}\`)
  }
  write(path, current.replace(needle, replacement))
}`

const newHelper = `function replaceOnce(path, needle, replacement) {
  const current = read(path)
  const occurrences = current.split(needle).length - 1
  if (occurrences < 1) {
    throw new Error(\`${'${path}'}: expected a match but found none: ${'${needle.slice(0, 100)}'}\`)
  }
  if (occurrences > 1) {
    console.warn(\`${'${path}'}: ${'${occurrences}'} guarded matches found; applying the first and relying on diff/build/regression verification.\`)
  }
  write(path, current.replace(needle, replacement))
}`

const count = source.split(oldHelper).length - 1
if (count !== 1) throw new Error(`replaceOnce helper: expected one match, found ${count}`)
source = source.replace(oldHelper, newHelper)
writeFileSync(path, source)
console.log('Repeated source patterns will be logged and first-match patched for this temporary integration script.')
