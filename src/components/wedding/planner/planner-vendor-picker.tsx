'use client'

import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface PlannerVendorOption {
  id: string
  name: string
  category: string
  email?: string | null
  contact?: string | null
  phone?: string | null
}

interface PlannerVendorPickerProps {
  vendors: PlannerVendorOption[]
  vendorId: string
  vendorName: string
  onChange: (value: { vendorId: string; vendorName: string }) => void
  inputId?: string
  placeholder?: string
  disabled?: boolean
}

function vendorContext(vendor: PlannerVendorOption): string {
  return [vendor.category.replaceAll('_', ' '), vendor.email, vendor.contact, vendor.phone]
    .filter(Boolean)
    .join(' · ')
}

export function PlannerVendorPicker({
  vendors,
  vendorId,
  vendorName,
  onChange,
  inputId = 'planner-vendor-picker',
  placeholder = 'Search an existing vendor or type a new name',
  disabled = false,
}: PlannerVendorPickerProps) {
  const [focused, setFocused] = useState(false)
  const selected = vendors.find((vendor) => vendor.id === vendorId) ?? null
  const query = vendorName.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!query) return vendors.slice(0, 6)
    return vendors
      .filter((vendor) =>
        [vendor.name, vendor.category, vendor.email ?? '', vendor.contact ?? '', vendor.phone ?? '']
          .some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 6)
  }, [query, vendors])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
        <Input
          id={inputId}
          value={vendorName}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange({ vendorId: '', vendorName: event.target.value })}
          className="border-gold/20 bg-espresso/70 pl-9 pr-9"
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={focused && matches.length > 0}
        />
        {(vendorId || vendorName) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear vendor"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange({ vendorId: '', vendorName: '' })}
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-champagne/45 hover:bg-gold/10 hover:text-gold"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {selected && (
        <p className="mt-1 flex items-center gap-1.5 font-sans text-[10px] text-sage-light">
          <Check className="size-3" /> Linked to existing Wewed wedding vendor · {vendorContext(selected) || selected.name}
        </p>
      )}

      {focused && !selected && matches.length > 0 && (
        <div role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gold/25 bg-espresso p-1.5 shadow-2xl">
          {matches.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange({ vendorId: vendor.id, vendorName: vendor.name })
                setFocused(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span className="block font-sans text-sm font-medium text-champagne">{vendor.name}</span>
              <span className="mt-0.5 block font-sans text-[10px] capitalize text-champagne/50">{vendorContext(vendor)}</span>
            </button>
          ))}
        </div>
      )}

      {focused && query && !selected && matches.length === 0 && (
        <p className="mt-1 font-sans text-[10px] text-champagne/45">No existing vendor matches. The typed name will remain an external/manual vendor.</p>
      )}
    </div>
  )
}
