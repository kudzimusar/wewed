'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const PLANNER_GUEST_ROLE_OPTIONS = [
  { value: 'guest', label: 'Guest' },
  { value: 'bridal_party', label: 'Bridal party' },
  { value: 'family', label: 'Family' },
  { value: 'officiant', label: 'Officiant' },
  { value: 'vip', label: 'VIP' },
] as const

export const PLANNER_GUEST_SIDE_OPTIONS = [
  { value: 'bride', label: "Bride's side" },
  { value: 'groom', label: "Groom's side" },
  { value: 'family', label: 'Shared family' },
  { value: 'neutral', label: 'Neutral / shared' },
] as const

export interface PlannerGuestEditorValue {
  name: string
  email: string
  phone: string
  role: string
  roleDetail: string
  side: string
  seatingTableId: string
}

export interface PlannerGuestEditorTable {
  id: string
  name: string
  capacity: number
}

export const EMPTY_PLANNER_GUEST_EDITOR_VALUE: PlannerGuestEditorValue = {
  name: '',
  email: '',
  phone: '',
  role: 'guest',
  roleDetail: '',
  side: 'neutral',
  seatingTableId: '',
}

export function PlannerGuestEditor({
  value,
  tables,
  onChange,
  idPrefix,
  tone = 'dark',
  disabled = false,
}: {
  value: PlannerGuestEditorValue
  tables: PlannerGuestEditorTable[]
  onChange: (value: PlannerGuestEditorValue) => void
  idPrefix: string
  tone?: 'dark' | 'light'
  disabled?: boolean
}) {
  const inputClass =
    tone === 'dark' ? 'mt-1 border-gold/20 bg-espresso/70' : 'mt-1 border-gold/20 bg-white'
  const selectClass =
    tone === 'dark'
      ? 'mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm'
      : 'mt-1 h-10 w-full rounded-md border border-gold/20 bg-white px-3 text-sm'

  const set = <K extends keyof PlannerGuestEditorValue>(
    key: K,
    next: PlannerGuestEditorValue[K],
  ) => onChange({ ...value, [key]: next })

  return (
    <div
      data-testid="canonical-planner-guest-editor"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Full name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(event) => set('name', event.target.value)}
          className={inputClass}
          disabled={disabled}
          required
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(event) => set('email', event.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={value.phone}
          onChange={(event) => set('phone', event.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-role`}>Participant type / role</Label>
        <select
          id={`${idPrefix}-role`}
          value={value.role}
          onChange={(event) => set('role', event.target.value)}
          className={selectClass}
          disabled={disabled}
        >
          {PLANNER_GUEST_ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-role-detail`}>Relationship / role detail</Label>
        <Input
          id={`${idPrefix}-role-detail`}
          value={value.roleDetail}
          onChange={(event) => set('roleDetail', event.target.value)}
          placeholder="e.g. Cousin, Best man, Family friend"
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-side`}>Attendance allocation</Label>
        <select
          id={`${idPrefix}-side`}
          value={value.side}
          onChange={(event) => set('side', event.target.value)}
          className={selectClass}
          disabled={disabled}
        >
          {PLANNER_GUEST_SIDE_OPTIONS.map((side) => (
            <option key={side.value} value={side.value}>{side.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-table`}>Seating table</Label>
        <select
          id={`${idPrefix}-table`}
          value={value.seatingTableId}
          onChange={(event) => set('seatingTableId', event.target.value)}
          className={selectClass}
          disabled={disabled}
        >
          <option value="">Unassigned</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>{table.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
