export interface PlannerDraftControl {
  type?: string
  value?: string
  defaultValue?: string
  checked?: boolean
  defaultChecked?: boolean
  files?: { length: number } | null
  options?: ArrayLike<{
    value: string
    defaultSelected?: boolean
  }>
}

const IGNORED_CONTROL_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'hidden',
  'image',
])

export function plannerControlHasDraft(control: PlannerDraftControl): boolean {
  const type = (control.type || '').toLowerCase()
  if (IGNORED_CONTROL_TYPES.has(type)) return false

  if (type === 'checkbox' || type === 'radio') {
    return Boolean(control.checked) !== Boolean(control.defaultChecked)
  }

  if (type === 'file') return Boolean(control.files?.length)

  if (control.options) {
    let initialValue = ''
    for (let index = 0; index < control.options.length; index += 1) {
      const option = control.options[index]
      if (option?.defaultSelected) {
        initialValue = option.value
        break
      }
    }
    return (control.value ?? '') !== initialValue
  }

  return (control.value ?? '') !== (control.defaultValue ?? '')
}

export function plannerFormHasDraft(
  controls: ArrayLike<PlannerDraftControl>,
): boolean {
  for (let index = 0; index < controls.length; index += 1) {
    const control = controls[index]
    if (control && plannerControlHasDraft(control)) return true
  }
  return false
}

export function hasUnsavedPlannerForms(root: ParentNode | null | undefined): boolean {
  if (!root) return false
  const forms = root.querySelectorAll<HTMLFormElement>(
    'form:not([data-planner-ignore-draft="true"])',
  )
  return Array.from(forms).some((form) =>
    plannerFormHasDraft(form.elements as unknown as ArrayLike<PlannerDraftControl>),
  )
}
