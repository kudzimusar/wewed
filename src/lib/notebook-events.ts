export const NOTEBOOK_QUICK_CAPTURE_OPEN_EVENT = 'wewed:notebook-quick-capture-open'

export function openNotebookQuickCapture(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTEBOOK_QUICK_CAPTURE_OPEN_EVENT))
}
