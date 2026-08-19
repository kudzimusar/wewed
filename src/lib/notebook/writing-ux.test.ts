import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const workspace = read('src/components/notebook/notebook-workspace.tsx')
const markdown = read('src/components/notebook/notebook-markdown.tsx')
const noteRoute = read('src/app/api/notebook/[id]/route.ts')
const actionRoute = read('src/app/api/notebook/[id]/actions/route.ts')
const history = read('src/lib/notebook/history.ts')
const standard = read('docs/NOTEBOOK_WRITING_AI_UX_STANDARD.md')

describe('WW-NOTEBOOK-WRITING-UX-2026-08-19-01', () => {
  test('renders Notebook Markdown instead of exposing raw formatting in reading surfaces', () => {
    expect(markdown).toContain("import ReactMarkdown from 'react-markdown'")
    expect(markdown).toContain('data-notebook-rendered-markdown')
    expect(workspace).toContain('<NotebookMarkdown markdown={aiPreview.previewText} />')
    expect(workspace).toContain("type EditorMode = 'read' | 'write'")
    expect(workspace).toContain("setEditorMode('read')")
  })

  test('makes AI guidance and governed actions immediately discoverable', () => {
    expect(workspace).toContain('data-notebook-ai-guide')
    expect(workspace).toContain('Use AI in 3 steps')
    expect(workspace).toContain("['Confirmed','Approved','Proposed','Pending','TBC','Quoted','Paid','Risk']")
    expect(workspace).toContain('data-notebook-suggest-actions')
    expect(workspace).toContain("runAi('SUGGEST_ACTIONS')")
    expect(workspace).toContain('fixed inset-x-3 bottom-3 top-[5.5rem]')
  })

  test('keeps autosave conflict safety but separates meaningful checkpoints from revisions', () => {
    expect(noteRoute).toContain('discardNotebookAutosaveVersion')
    expect(actionRoute).toContain("action === 'save-checkpoint'")
    expect(history).toContain("NOTEBOOK_MANUAL_CHECKPOINT_MARKER = 'manual-checkpoint-v1'")
    expect(history).toContain("AND source = 'USER'")
    expect(history).toContain('NOTE_CHECKPOINT_SAVED')
    expect(workspace).toContain('Save checkpoint')
    expect(workspace).toContain("saveState === 'saved' ? 'Saved'")
    expect(workspace).not.toContain('Saved · v${activeNote.version}')
    expect(workspace).toContain('Earlier autosave history')
  })

  test('records the WNPS-1 operating standard and safety boundary', () => {
    expect(standard).toContain('Source → Structure → Verify → Act → Retain')
    expect(standard).toContain('AI rewrites are previews until the user explicitly accepts them.')
    expect(standard).toContain('Autosave remains enabled and conflict-safe.')
  })
})
