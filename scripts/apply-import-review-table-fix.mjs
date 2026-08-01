import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Unable to find ${label}`)
  }
  return source.replace(search, replacement)
}

const importPath = 'src/components/wedding/import-dialog.tsx'
let source = readFileSync(importPath, 'utf8')

source = replaceOnce(
  source,
  "import { useCallback, useEffect, useMemo, useRef, useState } from 'react'",
  "import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'",
  'React import',
)

source = replaceOnce(
  source,
  "  const inputRef = useRef<HTMLInputElement>(null)\n",
  "  const inputRef = useRef<HTMLInputElement>(null)\n  const reviewTableScrollRef = useRef<HTMLDivElement>(null)\n",
  'review scroll ref insertion point',
)

source = replaceOnce(
  source,
  "  const hasRows = Boolean(preview && preview.totalRows > 0)\n  const blocking = Boolean(preview && (preview.missingRequired.length || preview.validRows === 0))\n",
  "  const hasRows = Boolean(preview && preview.totalRows > 0)\n\n  useEffect(() => {\n    if (step !== 'preview' || !preview) return\n    const frame = window.requestAnimationFrame(() => {\n      const container = reviewTableScrollRef.current\n      if (!container) return\n      container.scrollTop = 0\n      container.scrollLeft = 0\n    })\n    return () => window.cancelAnimationFrame(frame)\n  }, [step, preview?.fileName])\n\n  const blocking = Boolean(preview && (preview.missingRequired.length || preview.validRows === 0))\n",
  'preview scroll reset insertion point',
)

const oldReviewTable = `                  <div className="overflow-hidden rounded-xl border border-gold/15">
                    <div className="max-h-[min(24rem,45dvh)] overflow-auto overscroll-contain touch-pan-x touch-pan-y [scrollbar-gutter:stable]">
                      <Table className="min-w-[44rem]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Action</TableHead>
                            {sourceColumns.slice(0, 4).map((column) => <TableHead key={column}>{column}</TableHead>)}
                            <TableHead>Issues</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.rows.slice(0, 100).map((row) => (
                            <TableRow key={row.rowIndex}>
                              <TableCell>{row.rowIndex}</TableCell>
                              <TableCell><Action action={row.action} /></TableCell>
                              {sourceColumns.slice(0, 4).map((column) => (
                                <TableCell key={column} className="max-w-40 truncate">{row.raw[column] || '—'}</TableCell>
                              ))}
                              <TableCell className={row.errors.length ? 'text-clay-light' : 'text-champagne/45'}>
                                {row.errors.length ? row.errors.join('; ') : row.warnings.join('; ') || 'Ready'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>`

source = replaceOnce(
  source,
  oldReviewTable,
  `                  <ImportReviewRows
                    rows={preview.rows}
                    sourceColumns={sourceColumns}
                    scrollRef={reviewTableScrollRef}
                  />`,
  'existing import review table',
)

const oldConfirm = `          {step === 'confirm' && preview && (
            <div className="mx-auto max-w-xl rounded-xl border border-gold/25 bg-gold/5 p-6 text-center sm:p-8">
              <CheckCircle2 className="mx-auto size-12 text-gold" />
              <h3 className="mt-4 text-xl">Import {preview.newRecords + preview.updateRecords} records?</h3>
              <p className="mt-2 text-sm text-champagne/55">
                {preview.newRecords} new · {preview.updateRecords} updates · {preview.skippedRecords} skipped · {preview.invalidRows} invalid
              </p>
              <p className="mt-4 text-xs leading-5 text-champagne/45">
                The preview and rollback snapshot are stored against the active wedding and survive a server restart.
              </p>
            </div>
          )}`

source = replaceOnce(
  source,
  oldConfirm,
  `          {step === 'confirm' && preview && (
            <div className="space-y-5">
              <div className="mx-auto max-w-xl rounded-xl border border-gold/25 bg-gold/5 p-6 text-center sm:p-8">
                <CheckCircle2 className="mx-auto size-12 text-gold" />
                <h3 className="mt-4 text-xl">Import {preview.newRecords + preview.updateRecords} records?</h3>
                <p className="mt-2 text-sm text-champagne/55">
                  {preview.newRecords} new · {preview.updateRecords} updates · {preview.skippedRecords} skipped · {preview.invalidRows} invalid
                </p>
                <p className="mt-4 text-xs leading-5 text-champagne/45">
                  The preview and rollback snapshot are stored against the active wedding and survive a server restart.
                </p>
              </div>
              <ImportConfirmationRows
                rows={preview.rows.filter((row) => row.action === 'create' || row.action === 'update')}
                sourceColumns={sourceColumns}
              />
            </div>
          )}`,
  'confirmation summary',
)

const helpers = `
const REVIEW_COLUMN_PRIORITY = [
  'Guest ID',
  'First Name',
  'Last Name',
  'Display Name',
  'Task',
  'Title',
  'Vendor Name',
  'Email',
  'Phone',
]

function reviewColumns(sourceColumns: string[]) {
  const selected: string[] = []
  for (const column of REVIEW_COLUMN_PRIORITY) {
    if (sourceColumns.includes(column) && !selected.includes(column)) selected.push(column)
  }
  for (const column of sourceColumns) {
    if (!selected.includes(column)) selected.push(column)
    if (selected.length >= 6) break
  }
  return selected.slice(0, 6)
}

function rowIssues(row: RowAction) {
  return row.errors.length ? row.errors.join('; ') : row.warnings.join('; ') || 'Ready'
}

function ImportReviewRows({
  rows,
  sourceColumns,
  scrollRef,
}: {
  rows: RowAction[]
  sourceColumns: string[]
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const columns = reviewColumns(sourceColumns)
  const visibleRows = rows.slice(0, 100)

  return (
    <section aria-labelledby="import-review-records-heading" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="import-review-records-heading" className="text-sm font-medium text-champagne">Records found</h3>
          <p className="text-xs leading-5 text-champagne/45">Review the action and identity fields before continuing.</p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-champagne/35">{visibleRows.length} shown</p>
      </div>

      <div data-testid="import-review-cards" className="grid gap-3 md:hidden">
        {visibleRows.map((row) => (
          <article key={row.rowIndex} className="rounded-xl border border-gold/15 bg-espresso/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-champagne">Row {row.rowIndex}</span>
              <Action action={row.action} />
            </div>
            <dl className="mt-3 grid gap-2">
              {columns.map((column) => (
                <div key={column} className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                  <dt className="text-xs text-champagne/45">{column}</dt>
                  <dd className="break-words text-right text-xs text-champagne">{row.raw[column] || '—'}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                <dt className="text-xs text-champagne/45">Issues</dt>
                <dd className={\`break-words text-right text-xs \${row.errors.length ? 'text-clay-light' : 'text-champagne/55'}\`}>
                  {rowIssues(row)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gold/15 md:block">
        <div
          ref={scrollRef}
          data-testid="import-review-table-scroll"
          className="max-h-[min(24rem,45dvh)] overflow-auto overscroll-contain touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
        >
          <Table className="min-w-[56rem]" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-20 bg-espresso shadow-[0_1px_0_rgba(191,155,95,0.25)]">
              <TableRow className="bg-espresso hover:bg-espresso">
                <TableHead className="sticky left-0 z-30 w-16 bg-espresso">Row</TableHead>
                <TableHead>Action</TableHead>
                {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.rowIndex}>
                  <TableCell className="sticky left-0 z-10 bg-espresso font-medium">{row.rowIndex}</TableCell>
                  <TableCell><Action action={row.action} /></TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className="max-w-52 truncate" title={row.raw[column] || '—'}>{row.raw[column] || '—'}</TableCell>
                  ))}
                  <TableCell className={row.errors.length ? 'max-w-80 whitespace-normal text-clay-light' : 'max-w-80 whitespace-normal text-champagne/45'}>
                    {rowIssues(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

function ImportConfirmationRows({ rows, sourceColumns }: { rows: RowAction[]; sourceColumns: string[] }) {
  const columns = reviewColumns(sourceColumns)
  const visibleRows = rows.slice(0, 10)

  return (
    <section data-testid="import-confirmation-records" aria-labelledby="import-confirmation-records-heading" className="rounded-xl border border-gold/15 bg-espresso/45 p-4 sm:p-5">
      <h3 id="import-confirmation-records-heading" className="text-sm font-medium text-champagne">Records ready to import</h3>
      <p className="mt-1 text-xs leading-5 text-champagne/45">Confirm the action and identity details before writing to the active wedding.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visibleRows.map((row) => (
          <article key={row.rowIndex} className="rounded-lg border border-gold/15 bg-espresso/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-champagne">Row {row.rowIndex}</span>
              <Action action={row.action} />
            </div>
            <dl className="mt-3 grid gap-2">
              {columns.map((column) => (
                <div key={column} className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-gold/10 pt-2">
                  <dt className="text-xs text-champagne/45">{column}</dt>
                  <dd className="break-words text-right text-xs text-champagne">{row.raw[column] || '—'}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {rows.length > visibleRows.length && (
        <p className="mt-3 text-xs text-champagne/45">Plus {rows.length - visibleRows.length} additional record{rows.length - visibleRows.length === 1 ? '' : 's'}.</p>
      )}
    </section>
  )
}

`

source = replaceOnce(source, '\nfunction Stat(', `\n${helpers}function Stat(`, 'helper insertion point')
writeFileSync(importPath, source)

const tablePath = 'src/components/ui/table.tsx'
let tableSource = readFileSync(tablePath, 'utf8')
tableSource = replaceOnce(
  tableSource,
  'function Table({ className, ...props }: React.ComponentProps<"table">) {',
  'type TableProps = React.ComponentProps<"table"> & { containerClassName?: string }\n\nfunction Table({ className, containerClassName, ...props }: TableProps) {',
  'Table props',
)
tableSource = replaceOnce(
  tableSource,
  '      className="relative w-full overflow-x-auto"',
  '      className={cn("relative w-full overflow-x-auto", containerClassName)}',
  'Table container class',
)
writeFileSync(tablePath, tableSource)

const testPath = 'tests/e2e/planner-overlay-containment.spec.ts'
let testSource = readFileSync(testPath, 'utf8')
const oldAssertions = `      await expect(dialog.getByTestId('import-stat-rows').getByText('1', { exact: true })).toBeVisible()
      const reviewButton = dialog.getByRole('button', { name: 'Review import', exact: true })
      await expect(reviewButton).toBeEnabled()
      await expect(dialog.getByTestId('import-dialog-footer')).toBeInViewport()
      await reviewButton.click()
      await expect(dialog.getByRole('button', { name: 'Import now', exact: true })).toBeEnabled()
      await expect(dialog.getByText(/Import 1 records\\?/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(reviewButton).toBeEnabled()`
const newAssertions = `      await expect(dialog.getByTestId('import-stat-rows').getByText('1', { exact: true })).toBeVisible()
      if (viewport.width < 768) {
        const cards = dialog.getByTestId('import-review-cards')
        await expect(cards).toBeVisible()
        await expect(cards.getByText('Row 2', { exact: true })).toBeVisible()
        await expect(cards.getByText(email, { exact: true })).toBeVisible()
      } else {
        const tableScroll = dialog.getByTestId('import-review-table-scroll')
        const rowHeader = tableScroll.getByRole('columnheader', { name: 'Row', exact: true })
        await expect(tableScroll).toBeVisible()
        await expect(rowHeader).toBeVisible()
        await tableScroll.evaluate((element) => {
          element.scrollTop = element.scrollHeight
          element.scrollLeft = element.scrollWidth
        })
        await expect(rowHeader).toBeVisible()
        const scrollBox = await tableScroll.boundingBox()
        const headerBox = await rowHeader.boundingBox()
        expect(scrollBox).not.toBeNull()
        expect(headerBox).not.toBeNull()
        expect(headerBox!.y).toBeGreaterThanOrEqual(scrollBox!.y - 1)
        expect(headerBox!.y).toBeLessThanOrEqual(scrollBox!.y + 2)
      }
      const reviewButton = dialog.getByRole('button', { name: 'Review import', exact: true })
      await expect(reviewButton).toBeEnabled()
      await expect(dialog.getByTestId('import-dialog-footer')).toBeInViewport()
      await reviewButton.click()
      await expect(dialog.getByRole('button', { name: 'Import now', exact: true })).toBeEnabled()
      await expect(dialog.getByText(/Import 1 records\\?/)).toBeVisible()
      const confirmationRecords = dialog.getByTestId('import-confirmation-records')
      await expect(confirmationRecords).toBeVisible()
      await expect(confirmationRecords.getByText(email, { exact: true })).toBeVisible()
      await dialog.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(reviewButton).toBeEnabled()`
testSource = replaceOnce(testSource, oldAssertions, newAssertions, 'responsive import assertions')
writeFileSync(testPath, testSource)
