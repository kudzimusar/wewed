'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PROVIDER_CATEGORIES, PROVIDER_CATEGORY_VALUES, SERVICE_AREA_OPTIONS } from '@/lib/provider-catalog'
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

export function PublicRegistrationForm() {
  const searchParams = useSearchParams()
  const queryPlan = searchParams.get('plan')
  const initialPlan = isWewedPlanId(queryPlan) ? queryPlan : 'free'
  const queryAccountType = searchParams.get('accountType') || ''
  const initialAccountType = ACCOUNT_TYPES.has(queryAccountType) ? queryAccountType : 'couple'
  const queryService = searchParams.get('service') || ''
  const initialServices = initialAccountType === 'venue'
    ? ['venue']
    : PROVIDER_CATEGORY_VALUES.has(queryService) ? [queryService] : []
  const confirmationReturned = searchParams.get('confirmed') === '1'

  const [accountType, setAccountType] = useState(initialAccountType)
  const [requestedRole, setRequestedRole] = useState(roleOptions[initialAccountType]?.[0]?.value || 'viewer')
  const [requestedPlan, setRequestedPlan] = useState(initialPlan)
  const [requestedServices, setRequestedServices] = useState<string[]>(initialServices)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ id: string; confirmationRequired: boolean } | null>(null)

  const isProvider = accountType === 'venue' || accountType === 'vendor'
  const visibleCategories = useMemo(
    () => accountType === 'venue' ? PROVIDER_CATEGORIES.filter((category) => category.value === 'venue') : PROVIDER_CATEGORIES,
    [accountType],
  )

  function changeType(value: string) {
    setAccountType(value)
    setRequestedRole(roleOptions[value]?.[0]?.value || 'viewer')
    if (value === 'venue') setRequestedServices(['venue'])
    else if (value !== 'vendor') setRequestedServices([])
    else if (requestedServices.includes('venue')) setRequestedServices([])
  }

  function toggleService(value: string) {
    if (accountType === 'venue') return
    setRequestedServices((current) => current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value].slice(0, 8))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    const form = new FormData(event.currentTarget)

    if (isProvider && requestedServices.length === 0) {
      setError('Select at least one wedding service offered by the business.')
      setWorking(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          phoneCountryCode: form.get('phoneCountryCode'),
          phone: form.get('phone'),
          businessName: form.get('businessName'),
          country: form.get('country'),
          city: form.get('city'),
          primaryServiceArea: form.get('primaryServiceArea'),
          website: form.get('website'),
          socialProfile: form.get('socialProfile'),
          registrationNumber: form.get('registrationNumber'),
          notes: form.get('notes'),
          accountType,
          requestedRole,
          requestedPlan,
          requestedServices: isProvider ? requestedServices : [],
          requestedService: isProvider ? requestedServices[0] : null,
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
          <p className="mt-3 text-sm text-champagne/55">Wewed verifies the confirmation state, then completes approval and account onboarding.</p>
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
          <p className="mt-3 text-sm text-champagne/65">Your account is pending Wewed review. Approval is followed by structured onboarding and profile completion.</p>
          {success.confirmationRequired && <p className="mt-3 text-sm text-gold-light">Check your email to confirm your Supabase identity.</p>}
          <p className="mt-5 rounded-xl border border-gold/15 bg-black/10 px-4 py-3 text-xs text-champagne/45">Application reference: {success.id}</p>
          <Button asChild className="mt-6 bg-gold text-espresso hover:bg-gold-light"><a href="/">Return to Wewed</a></Button>
        </CardContent>
      </Card>
    )
  }

  const fieldClass = 'border-gold/25 bg-black/15 text-champagne placeholder:text-champagne/35 focus-visible:ring-gold'
  const selectClass = 'mt-1 h-11 w-full rounded-md border border-gold/25 bg-espresso px-3 text-sm text-champagne focus:outline-none focus:ring-2 focus:ring-gold'

  return (
    <Card className="border-gold/25 bg-white/[0.045] text-champagne shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create a Wewed application</CardTitle>
        <p className="text-sm text-champagne/55">Start with the essentials. Approved businesses complete their detailed category-specific profile after review.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input name="name" autoComplete="name" placeholder="Your full name" required className={fieldClass} />
          <Input name="email" type="email" autoComplete="email" placeholder="Email address" required className={fieldClass} />
          <Input name="password" type="password" autoComplete="new-password" minLength={12} placeholder="Password — 12+ characters" required className={fieldClass} />
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <label className="text-xs text-champagne/55">Country code<select name="phoneCountryCode" defaultValue="+263" className={selectClass}><option value="+263">+263</option><option value="+27">+27</option><option value="+267">+267</option><option value="+258">+258</option><option value="+260">+260</option><option value="+44">+44</option><option value="+1">+1</option><option value="other">Other</option></select></label>
            <label className="text-xs text-champagne/55">Phone number<Input name="phone" autoComplete="tel-national" inputMode="tel" placeholder="Phone number" className={`mt-1 ${fieldClass}`} /></label>
          </div>

          <label className="text-xs text-champagne/55">Account type<select value={accountType} onChange={(event) => changeType(event.target.value)} className={selectClass}>
            <option value="couple">Couple / wedding client</option>
            <option value="planning_company">Planning company</option>
            <option value="venue">Venue</option>
            <option value="vendor">Wedding service business</option>
            <option value="client">Other business client</option>
          </select></label>

          <label className="text-xs text-champagne/55">Requested role<select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value)} className={selectClass}>
            {(roleOptions[accountType] || roleOptions.client).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>

          <Input name="businessName" autoComplete="organization" placeholder={accountType === 'couple' ? 'Couple or wedding name' : 'Business or trading name'} required className={`${fieldClass} md:col-span-2`} />

          {isProvider && (
            <fieldset className="rounded-2xl border border-gold/20 bg-black/10 p-4 md:col-span-2">
              <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold">Wedding services</legend>
              <p className="mb-3 text-xs leading-5 text-champagne/55">Choose every service the business intends to publish. Each service gets a separate, relevant profile form after approval.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCategories.map((category) => (
                  <label key={category.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition ${requestedServices.includes(category.value) ? 'border-gold bg-gold/10' : 'border-gold/15 bg-black/10 hover:border-gold/35'}`}>
                    <input type="checkbox" checked={requestedServices.includes(category.value)} onChange={() => toggleService(category.value)} disabled={accountType === 'venue'} className="mt-0.5 accent-[#BF9B5F]" />
                    <span><span className="block font-semibold text-champagne">{category.label}</span><span className="mt-1 block leading-4 text-champagne/45">{category.description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {isProvider && <>
            <label className="text-xs text-champagne/55">Country<Input name="country" autoComplete="country-name" placeholder="Country" required className={`mt-1 ${fieldClass}`} /></label>
            <label className="text-xs text-champagne/55">City / town<Input name="city" autoComplete="address-level2" placeholder="City or town" required className={`mt-1 ${fieldClass}`} /></label>
            <label className="text-xs text-champagne/55">Primary service area<select name="primaryServiceArea" defaultValue="" required className={selectClass}><option value="" disabled>Select primary service area</option>{SERVICE_AREA_OPTIONS.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
            <label className="text-xs text-champagne/55">Business registration number<Input name="registrationNumber" placeholder="Optional at application stage" className={`mt-1 ${fieldClass}`} /></label>
            <label className="text-xs text-champagne/55">Website<Input name="website" type="url" autoComplete="url" placeholder="https://" className={`mt-1 ${fieldClass}`} /></label>
            <label className="text-xs text-champagne/55">Social profile<Input name="socialProfile" type="url" placeholder="https://instagram.com/..." className={`mt-1 ${fieldClass}`} /></label>
          </>}

          <label className="text-xs text-champagne/55">Preferred plan<select value={requestedPlan} onChange={(event) => setRequestedPlan(event.target.value)} className={selectClass}>
            {WEWED_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.publicName}{plan.id === 'enterprise' ? ' — sales-assisted' : ''}</option>)}
          </select></label>

          <textarea name="notes" placeholder="Tell us what you need from Wewed (optional)" maxLength={2000} className="min-h-24 rounded-md border border-gold/25 bg-black/15 px-3 py-2 text-sm text-champagne placeholder:text-champagne/35 md:col-span-2" />

          <label className="flex items-start gap-3 text-xs leading-5 text-champagne/55 md:col-span-2"><input name="acceptedTerms" type="checkbox" required className="mt-1 accent-[#BF9B5F]" />I confirm that the information is accurate and understand that registration creates a pending application, not immediate dashboard, administrative or wedding access.</label>

          {error && <p role="alert" className="rounded-lg border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100 md:col-span-2">{error}</p>}

          <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={working} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Submit for review</Button></div>
        </form>
      </CardContent>
    </Card>
  )
}
