'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VendorRow {
  id: string
  name: string
  category: string
  contact: string
  contractStatus: string
  paymentStatus: string
  notes: string
  phone: string | null
  website: string | null
}

interface VendorForm {
  name: string
  category: string
  contact: string
}

interface PlannerVendorsModuleProps {
  vendors: VendorRow[]
  vendorForm: VendorForm
  setVendorForm: Dispatch<SetStateAction<VendorForm>>
  saving: boolean
  onAddVendor: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
}

const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'videographer',
  'florist',
  'dj',
  'decor',
  'transport',
  'stationery',
  'other',
]

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>
      {children}
    </section>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center">
      <p className="font-serif text-lg text-champagne">{title}</p>
      <p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">
        {detail}
      </p>
    </div>
  )
}

export function PlannerVendorsModule({
  vendors,
  vendorForm,
  setVendorForm,
  saving,
  onAddVendor,
}: PlannerVendorsModuleProps) {
  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <form onSubmit={onAddVendor} className="grid gap-3 md:grid-cols-[2fr_1fr_1.5fr_auto]">
          <div>
            <Label>Name</Label>
            <Input
              value={vendorForm.name}
              onChange={(event) =>
                setVendorForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Supplier name"
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={vendorForm.category}
              onChange={(event) =>
                setVendorForm((current) => ({ ...current, category: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {VENDOR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Contact</Label>
            <Input
              value={vendorForm.contact}
              onChange={(event) =>
                setVendorForm((current) => ({ ...current, contact: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Contact person or email"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="self-end bg-gold text-espresso hover:bg-gold-light"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        {vendors.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              title="No vendors yet"
              detail="Add suppliers as you source them. Procurement status is kept with the selected wedding."
            />
          </div>
        ) : (
          vendors.map((vendor) => (
            <SectionCard key={vendor.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg">{vendor.name}</h3>
                  <p className="font-sans text-xs text-champagne/45">
                    {titleCase(vendor.category)} · {vendor.contact || 'No contact added'}
                  </p>
                </div>
                <Badge variant="outline" className="border-gold/20 text-gold">
                  {titleCase(vendor.contractStatus)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-champagne/55">
                <span>Payment: {titleCase(vendor.paymentStatus)}</span>
                {vendor.phone && <span>· {vendor.phone}</span>}
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </div>
  )
}
