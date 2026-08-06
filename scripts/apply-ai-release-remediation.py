from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    path.write_text(text.replace(old, new, 1))


assistant = Path("src/components/wedding/ai-planner-assistant.tsx")
clipboard_helper = '''async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the selection-based browser fallback.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

'''
replace_once(
    assistant,
    "function Markdown({ children }: { children: string })",
    clipboard_helper + "function Markdown({ children }: { children: string })",
    "clipboard helper",
)
replace_once(
    assistant,
    '''function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch {
      // Manual selection remains available.
    }
  }

  return (''',
    '''function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    const copied = await copyTextToClipboard(message.content)
    setCopyState(copied ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 2_000)
  }

  return (''',
    "copy handler",
)
replace_once(
    assistant,
    '''            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 text-[9px] text-gold"
            >
              <Copy className="size-3" /> Copy
            </button>''',
    '''            <button
              type="button"
              onClick={() => void copy()}
              aria-label={copyState === 'copied' ? 'Copied AI response' : 'Copy AI response'}
              aria-live="polite"
              className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[9px] text-gold transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <Copy className="size-3" />
              {copyState === 'copied'
                ? 'Copied'
                : copyState === 'failed'
                  ? 'Select text to copy'
                  : 'Copy'}
            </button>''',
    "copy button feedback",
)

Path("src/lib/ai/task-due-state.ts").write_text('''const DAY_MS = 24 * 60 * 60 * 1_000

function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

export function describeTaskDueState(
  dueDate: Date | null,
  status: string,
  now: Date,
): string {
  const normalizedStatus = status.trim().toLowerCase()
  if (['completed', 'done', 'cancelled', 'canceled'].includes(normalizedStatus)) {
    return normalizedStatus
  }
  if (!dueDate) return 'no_due_date'

  const dayDifference = Math.round((utcDay(dueDate) - utcDay(now)) / DAY_MS)
  if (dayDifference < 0) return `overdue_by_${Math.abs(dayDifference)}_days`
  if (dayDifference === 0) return 'due_today'
  if (dayDifference === 1) return 'due_tomorrow'
  return `due_in_${dayDifference}_days`
}
''')

context = Path("src/lib/ai/workspace-context.ts")
replace_once(
    context,
    "import { db } from '@/lib/db'\n",
    "import { db } from '@/lib/db'\nimport { describeTaskDueState } from '@/lib/ai/task-due-state'\n",
    "due-state import",
)
replace_once(
    context,
    "  const has = (permission: AiContextPermission) =>\n    permissions.includes('*') || permissions.includes(permission)\n\n",
    "  const has = (permission: AiContextPermission) =>\n    permissions.includes('*') || permissions.includes(permission)\n  const contextGeneratedAt = new Date()\n\n",
    "context timestamp declaration",
)
replace_once(
    context,
    "    'AUTHORISED PLANNER CONTEXT',\n    `Wedding: ${cleanLine(wedding.title)}`,
    "    'AUTHORISED PLANNER CONTEXT',\n    `Context generated at (UTC): ${contextGeneratedAt.toISOString()}`,\n    `Wedding: ${cleanLine(wedding.title)}`,
    "context timestamp output",
)
replace_once(
    context,
    "        task.dueDate?.toISOString() ?? 'no due date',\n        task.assignee ?? 'unassigned',",
    "        task.dueDate?.toISOString() ?? 'no due date',\n        `due_state ${describeTaskDueState(task.dueDate, task.status, contextGeneratedAt)}`,\n        task.assignee ?? 'unassigned',",
    "task due-state output",
)

route = Path("src/app/api/ai/chat/route.ts")
replace_once(
    route,
    "Analyse authorised planning information such as tasks, RSVPs, vendors, budget, payments, timeline, risks, and cultural considerations. Prioritise concrete next steps, dependencies, overdue work, conflicts, missing decisions, and operational risks. Keep normal answers under 300 words. Any proposed change must be presented as a recommendation requiring confirmation through Wewed's action-review flow.",
    "Analyse authorised planning information such as tasks, RSVPs, vendors, budget, payments, timeline, risks, and cultural considerations. Prioritise concrete next steps, dependencies, overdue work, conflicts, missing decisions, and operational risks. The application context includes a server-generated UTC timestamp and a deterministic due_state for every task. Use due_state exactly when describing overdue, due-today, tomorrow, or future work; never recalculate or contradict it. Keep normal answers under 300 words. Any proposed change must be presented as a recommendation requiring confirmation through Wewed's action-review flow.",
    "planner due-state prompt",
)

Path("src/lib/ai/task-due-state.test.ts").write_text('''import { describe, expect, test } from 'bun:test'
import { describeTaskDueState } from './task-due-state'

describe('describeTaskDueState', () => {
  const now = new Date('2026-08-06T09:00:00.000Z')

  test('keeps future UAT dates in the future', () => {
    expect(
      describeTaskDueState(
        new Date('2027-12-30T10:00:00.000Z'),
        'in_progress',
        now,
      ),
    ).toBe('due_in_511_days')
  })

  test('classifies relative dates deterministically', () => {
    expect(describeTaskDueState(new Date('2026-08-05T10:00:00.000Z'), 'todo', now))
      .toBe('overdue_by_1_days')
    expect(describeTaskDueState(new Date('2026-08-06T23:00:00.000Z'), 'todo', now))
      .toBe('due_today')
    expect(describeTaskDueState(new Date('2026-08-07T01:00:00.000Z'), 'todo', now))
      .toBe('due_tomorrow')
  })

  test('does not mark completed or undated tasks overdue', () => {
    expect(
      describeTaskDueState(
        new Date('2026-08-01T00:00:00.000Z'),
        'completed',
        now,
      ),
    ).toBe('completed')
    expect(describeTaskDueState(null, 'todo', now)).toBe('no_due_date')
  })
})
''')

Path(".github/workflows/ai-release-remediation.yml").unlink()
Path(__file__).unlink()
