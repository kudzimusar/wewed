'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WEWED_PLANS, isWewedPlanId } from '@/lib/wewed-plans'

const roleOptions: Record<string, Array<{ value: string; label: string }>> = {
  planning_company: [
    { value: 'business_owner', label: 'Planning business owner' },
    { value: 'planner', label: 'Wedding planner' },
    { value: 'coordinator', label: 'Coordinator' },
  ],
  couple: [{ value: 'couple_owner', label: 'Couple / wedding owner' }],
  venue: [
    { value: 'business_owner', label: 'Venue owner' },
    { value: 'venue_manager', label: 'Venue manager' },
  ],
  vendor: [
    { value: 'business_owner', label: 'Vendor owner' },
    { value: 'vendor_manager', label: 'Vendor manager' },
  ],
  client: [
    { value: 'business_owner', label: 'Business owner' },
    { value: 'viewer', label: 'Business user' },
  ],
}

const ACCOUNT_TYPES = new Set(Object.keys(roleOptions))
const providerServices = [
  { value: 'venue', label: 'Venue' },
  { value: 'photography', label: 'Photography' },
  { value: 'florals', label: 'Florals' },
  { value: 'catering', label: 'Catering' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'decor-rentals', label: 'Décor & rentals' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'transport', label: 'Transport' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'other', label: 'Other wedding service' },
] as const
const PROVIDER_SERVICE_VALUES = new Set(providerServices.map((service) => service.value))

export function PublicRegistrationForm() {
  const searchParams = useSearchParams()
  const queryPlan = searchParams.get('plan')
  const initialPlan = isWewedPlanId(queryPlan) ? queryPlan : 'free'
  const queryAccountType = searchParams.get('accountType') || ''
  const initialAccountType = ACCOUNT_TYPES.has(queryAccountType) ? queryAccountType : 'couple'
  const queryService = searchParams.get('service') || ''
  const initialService = initialAccountType === 'venue'
    ? 'venue'
    : PROVIDER_SERVICE_VALUES.has(queryService as typeof providerServices[number]['value']) ? queryService : 'other'
  const confirmationReturned = searchParams.get('confirmed') === '1'

  const [accountType, setAccountType] = useState(initialAccountType)
  const [requestedRole, setRequestedRole] = useState(roleOptions[initialAccountType]?.[0]?.value || 'viewer')
  const [requestedPlan, setRequestedPlan] = useState(initialPlan)
  const [requestedService, setRequestedService] = useState(initialService)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ id: string; confirmationRequired: boolean } | null>(null)

  function changeType(value: string) {
    setAccountType(value)
    setRequestedRole(roleOptions[value]?.[0]?.value || 'viewer')
    if (value === 'venue') setRequestedService('venue')
    else if (value === 'vendor' && requestedService === 'venue') setRequestedService('other')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    const form = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          phone: form.get('phone'),
          businessName: form.get('businessName'),
          notes: form.get('notes'),
          accountType,
          requestedRole,
          requestedPlan,
          requestedService: accountType === 'venue' || accountType === 'vendor' ? requestedService : null,
          acceptedTerms: form.get('acceptedTerms') === 'on',
        }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        applicationId?: string
        confirmationRequired?: boolean
        error?: string
      }
      if (!response.ok || !payload.success || !payload.applicationId) {
        throw new Error(payload.error || 'Unable to submit your application.')
      }
      setSuccess({ id: payload.applicationId, confirmationRequired: Boolean(payload.confirmationRequired) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit your application.')
    } finally {
      setWorking(false)
    }
  }

  if (confirmationReturned) {
    return (
      <Card className="border-gold/25 bg-white/[0.05] text-champagne">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-gold" />
          <h2 className="mt-4 text-2xl font-semibold">Application pending review</h2>
          <p className="mt-3 text-sm text-champagne/65">Your application is already in Wewed&apos;s review flow. Do not submit another application.</p>
          <p className="mt-3 text-sm text-champagne/55">Email links can appear expired after they have already been consumed. Wewed will verify the confirmation state, then complete approval and internal onboarding.</p>
          <div className="mt-5 rounded-xl border border-gold/15 bg-black/10 px-4 py-3 text-xs text-champagne/50">Next step: Wewed administrator approval, followed by account and workspace setup.</div>
          <Button asChild className="mt-6 bg-gold text-espresso hover:bg-gold-light"><a href="/">Return to Wewed</a></Button>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="border-gold/25 bg-white/[0.05] text-champagne">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-gold" />
          <h2 className="mt-4 text-2xl font-semibold">Application submitted</h2>
          <p className="mt-3 text-sm text-champagne/65">Your account is pending Wewed review. Approval is followed by internal onboarding and workspace assignment.</p>
          {success.confirmationRequired && <p className="mt-3 text-sm text-gold-light">Check your email to confirm your Supabase identity.</p>}
          <p className="mt-5 rounded-xl border border-gold/15 bg-black/10 px-4 py-3 text-xs text-champagne/45">Application reference: {success.id}</p>
          <Button asChild className="mt-6 bg-gold text-espresso hover:bg-gold-light"><a href="/">Return to Wewed</a></Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gold/25 bg-white/[0.045] text-champagne shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create a Wewed application</CardTitle>
        <p className="text-sm text-champagne/55">Register publicly, then Wewed reviews and completes internal onboarding.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input name="name" autoComplete="name" placeholder="Your full name" required className="border-gold/20 bg-black/15" />
          <Input name="email" type="email" autoComplete="email" placeholder="Email address" required className="border-gold/20 bg-black/15" />
          <Input name="password" type="password" autoComplete="new-password" minLength={12} placeholder="Password — 12+ characters" required className="border-gold/20 bg-black/15" />
          <Input name="phone" autoComplete="tel" placeholder="Phone number (optional)" className="border-gold/20 bg-black/15" />

          <label className="text-xs text-champagne/50">
            Account type
            <select value={accountType} onChange={(event) => changeType(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne">
              <option value="couple">Couple / wedding client</option>
              <option value="planning_company">Planning company</option>
              <option value="venue">Venue</option>
              <option value="vendor">Vendor</option>
              <option value="client">Other business client</option>
            </select>
          </label>

          <label className="text-xs text-champagne/50">
            Requested role
            <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne">
              {(roleOptions[accountType] || roleOptions.client).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          {(accountType === 'venue' || accountType === 'vendor') && (
            <label className="text-xs text-champagne/50 md:col-span-2">
              Primary wedding service
              <select value={requestedService} onChange={(event) => setRequestedService(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne" required>
                {providerServices
                  .filter((service) => accountType !== 'venue' || service.value === 'venue')
                  .map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}
              </select>
            </label>
          )}

          <Input name="businessName" placeholder={accountType === 'couple' ? 'Couple or wedding name' : 'Business name'} required className="border-gold/20 bg-black/15 md:col-span-2" />

          <label className="text-xs text-champagne/50">
            Preferred plan
            <select value={requestedPlan} onChange={(event) => setRequestedPlan(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne">
              {WEWED_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.publicName}{plan.id === 'enterprise' ? ' — sales-assisted' : ''}</option>)}
            </select>
          </label>

          <textarea name="notes" placeholder="Tell us what you need from Wewed (optional)" className="min-h-24 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm md:col-span-2" />

          <label className="flex items-start gap-3 text-xs leading-5 text-champagne/55 md:col-span-2">
            <input name="acceptedTerms" type="checkbox" required className="mt-1" />
            I confirm that the information is accurate and understand that registration creates a pending application, not immediate dashboard or administrative access.
          </label>

          {error && <p className="rounded-lg border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100 md:col-span-2">{error}</p>}

          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={working} className="bg-gold text-espresso hover:bg-gold-light">
              {working ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Submit for review
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
