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

const controlBaselines = new WeakMap<object, string>()

function controlState(control: PlannerDraftControl): string {
  const type = (control.type || '').toLowerCase()
  if (IGNORED_CONTROL_TYPES.has(type)) return '__ignored__'
  if (type === 'checkbox' || type === 'radio') {
    return control.checked ? 'checked' : 'unchecked'
  }
  if (type === 'file') return control.files?.length ? `files:${control.files.length}` : 'files:0'
  return control.value ?? ''
}

function fallbackInitialState(control: PlannerDraftControl): string {
  const type = (control.type || '').toLowerCase()
  if (IGNORED_CONTROL_TYPES.has(type)) return '__ignored__'
  if (type === 'checkbox' || type === 'radio') {
    return control.defaultChecked ? 'checked' : 'unchecked'
  }
  if (type === 'file') return 'files:0'
  if (control.options) {
    for (let index = 0; index < control.options.length; index += 1) {
      const option = control.options[index]
      if (option?.defaultSelected) return option.value
    }
  }
  return control.defaultValue ?? ''
}

export function capturePlannerControlBaseline(
  control: PlannerDraftControl,
  overwrite = false,
): void {
  if (!control || typeof control !== 'object') return
  if (!overwrite && controlBaselines.has(control as object)) return
  controlBaselines.set(control as object, controlState(control))
}

export function plannerControlHasDraft(control: PlannerDraftControl): boolean {
  const current = controlState(control)
  if (current === '__ignored__') return false
  const initial = controlBaselines.get(control as object) ?? fallbackInitialState(control)
  return current !== initial
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

export function capturePlannerFormBaselines(root: ParentNode | null | undefined): void {
  if (!root) return
  const forms = root.querySelectorAll<HTMLFormElement>(
    'form:not([data-planner-ignore-draft="true"])',
  )
  for (const form of Array.from(forms)) {
    const controls = form.elements as unknown as ArrayLike<PlannerDraftControl>
    for (let index = 0; index < controls.length; index += 1) {
      const control = controls[index]
      if (control) capturePlannerControlBaseline(control)
    }
  }
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
