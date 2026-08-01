import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Unable to find ${label}`)
  return source.replace(search, replacement)
}

const dialogPath = 'src/components/wedding/import-dialog.tsx'
let dialog = readFileSync(dialogPath, 'utf8')
dialog = replaceOnce(
  dialog,
  '<TableHead className="sticky left-0 z-30 w-16 bg-espresso">Row</TableHead>',
  '<TableHead data-testid="import-review-row-header" className="sticky left-0 z-30 w-16 bg-espresso">Row</TableHead>',
  'review row header',
)
writeFileSync(dialogPath, dialog)

const overlayPath = 'tests/e2e/planner-overlay-containment.spec.ts'
let overlay = readFileSync(overlayPath, 'utf8')
overlay = replaceOnce(
  overlay,
  "const rowHeader = tableScroll.getByRole('columnheader', { name: 'Row', exact: true })",
  "const rowHeader = tableScroll.getByTestId('import-review-row-header')",
  'overlay row header locator',
)
writeFileSync(overlayPath, overlay)

const workflowsPath = 'tests/e2e/planner-data-workflows.spec.ts'
let workflows = readFileSync(workflowsPath, 'utf8')
workflows = replaceOnce(
  workflows,
  "await expect(importDialog.getByText(importedTask, { exact: true })).toBeVisible()",
  "await expect(importDialog.getByTestId('import-review-table-scroll').getByRole('cell', { name: importedTask, exact: true })).toBeVisible()",
  'round-trip preview locator',
)
workflows = replaceOnce(
  workflows,
  "await expect(dialog.getByText(/Formula detected in \"First Name\"/)).toBeVisible()",
  "await expect(dialog.getByTestId('import-review-table-scroll').getByRole('cell').filter({ hasText: /Formula detected in \"First Name\"/ })).toBeVisible()",
  'formula preview locator',
)
writeFileSync(workflowsPath, workflows)
