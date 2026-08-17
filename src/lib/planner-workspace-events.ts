export const PLANNER_COMMAND_CENTER_OPEN_EVENT = 'wewed:planner-command-center-open'
export const PLANNER_REFRESH_EVENT = 'wewed:planner-refresh'

export function openPlannerWorksheetCommandCenter(): void {
  if (typeof window === 'undefined') return

  const existingTrigger = document.querySelector<HTMLButtonElement>(
    '[data-testid="planner-worksheet-command-trigger"].fixed',
  )
  if (existingTrigger) {
    existingTrigger.click()
    return
  }

  window.dispatchEvent(new CustomEvent(PLANNER_COMMAND_CENTER_OPEN_EVENT))
}

export function refreshPlannerWorksheet(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PLANNER_REFRESH_EVENT))
}
