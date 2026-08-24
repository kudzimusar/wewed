'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarRange, Layers3, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type Resource = { id: string; name: string; resourceType: string; capacity: number; variantId?: string | null }
type Variant = { id: string; name: string; sku: string }
type Item = {
  id: string
  name: string
  slug: string
  category: string
  bookingArchetype: string
  bookingMode: string
  status: string
  resources: Resource[]
  variants: Variant[]
  availabilityPolicy?: Record<string, unknown>
}
type Rule = { id: string; resourceId: string; resourceName: string; ruleType: string; dayOfWeek?: number | null; startsAt?: string | null; endsAt?: string | null; startTime?: string | null; endTime?: string | null; capacityOverride?: number | null; reason?: string | null }
type Candidate = { id: string; name: string; slug: string; category: string; variants: Variant[] }
type Component = { id: string; componentKind: string; name: string; quantity: number; isOptional: boolean; selectionKey?: string | null; childItemName: string; childVariantName?: string | null }

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function VendorAvailabilityPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [policy, setPolicy] = useState({ timezone:'Africa/Harare',minNoticeMinutes:'',bookingHorizonDays:'',minDurationMinutes:'',maxDurationMinutes:'',serviceAreas:'' })
  const [rule, setRule] = useState({ resourceId:'', ruleType:'weekly', dayOfWeek:'6', startTime:'08:00', endTime:'18:00', startsAt:'', endsAt:'', capacityOverride:'', reason:'' })
  const [component, setComponent] = useState({ childCatalogItemId:'', childVariantId:'', componentKind:'package', selectionKey:'', name:'', quantity:'1', isOptional:false })

  const selected = useMemo(() => items.find((item) => item.id === itemId) || null, [items,itemId])

  const loadCatalog = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/vendor/catalog', { cache:'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load catalogue.')
      const nextItems = payload.data.items as Item[]
      setItems(nextItems)
      setItemId((current) => current || nextItems[0]?.id || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load catalogue.') }
    finally { setLoading(false) }
  }, [])

  const loadItem = useCallback(async (targetId: string) => {
    if (!targetId) { setRules([]); setComponents([]); setCandidates([]); return }
    setError('')
    try {
      const [ruleResponse, componentResponse] = await Promise.all([
        fetch(`/api/vendor/catalog/${encodeURIComponent(targetId)}/availability-rules`, { cache:'no-store' }),
        fetch(`/api/vendor/catalog/${encodeURIComponent(targetId)}/components`, { cache:'no-store' }),
      ])
      const [rulePayload, componentPayload] = await Promise.all([ruleResponse.json(), componentResponse.json()])
      if (!ruleResponse.ok || !rulePayload.success) throw new Error(rulePayload.error || 'Unable to load availability rules.')
      if (!componentResponse.ok || !componentPayload.success) throw new Error(componentPayload.error || 'Unable to load package components.')
      setRules(rulePayload.data || [])
      setComponents(componentPayload.data.components || [])
      setCandidates(componentPayload.data.candidates || [])
      const current = items.find((item) => item.id === targetId)
      const nextPolicy = current?.availabilityPolicy || {}
      setPolicy({
        timezone: typeof nextPolicy.timezone === 'string' ? nextPolicy.timezone : 'Africa/Harare',
        minNoticeMinutes: nextPolicy.minNoticeMinutes == null ? '' : String(nextPolicy.minNoticeMinutes),
        bookingHorizonDays: nextPolicy.bookingHorizonDays == null ? '' : String(nextPolicy.bookingHorizonDays),
        minDurationMinutes: nextPolicy.minDurationMinutes == null ? '' : String(nextPolicy.minDurationMinutes),
        maxDurationMinutes: nextPolicy.maxDurationMinutes == null ? '' : String(nextPolicy.maxDurationMinutes),
        serviceAreas: Array.isArray(nextPolicy.serviceAreas) ? nextPolicy.serviceAreas.join(', ') : '',
      })
      setRule((currentRule) => ({ ...currentRule, resourceId: currentRule.resourceId || current?.resources?.[0]?.id || '' }))
      setComponent((currentComponent) => ({ ...currentComponent, childCatalogItemId: currentComponent.childCatalogItemId || componentPayload.data.candidates?.[0]?.id || '' }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load item configuration.') }
  }, [items])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { void loadItem(itemId) }, [itemId, loadItem])

  async function request(url: string, method: string, body?: Record<string, unknown>) {
    const response = await fetch(url, { method, headers: body ? {'content-type':'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save configuration.')
    return payload
  }

  async function savePolicy() {
    if (!selected) return
    setBusy('policy'); setError(''); setMessage('')
    try {
      const numberOrNull = (value: string) => value.trim() ? Number(value) : null
      const availabilityPolicy = {
        ...(selected.availabilityPolicy || {}),
        timezone: policy.timezone.trim() || 'Africa/Harare',
        minNoticeMinutes: numberOrNull(policy.minNoticeMinutes),
        bookingHorizonDays: numberOrNull(policy.bookingHorizonDays),
        minDurationMinutes: numberOrNull(policy.minDurationMinutes),
        maxDurationMinutes: numberOrNull(policy.maxDurationMinutes),
        serviceAreas: policy.serviceAreas.split(',').map((entry) => entry.trim()).filter(Boolean),
      }
      await request(`/api/vendor/catalog/${encodeURIComponent(selected.id)}`, 'PATCH', { availabilityPolicy })
      setMessage('Booking policy saved. Deterministic availability now uses these limits.')
      await loadCatalog()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save booking policy.') }
    finally { setBusy('') }
  }

  async function addRule() {
    if (!selected) return
    setBusy('rule'); setError(''); setMessage('')
    try {
      await request(`/api/vendor/catalog/${encodeURIComponent(selected.id)}/availability-rules`, 'POST', {
        resourceId: rule.resourceId,
        ruleType: rule.ruleType,
        dayOfWeek: rule.ruleType === 'weekly' ? Number(rule.dayOfWeek) : null,
        startTime: rule.ruleType === 'weekly' ? rule.startTime : null,
        endTime: rule.ruleType === 'weekly' ? rule.endTime : null,
        startsAt: ['blackout','available_window'].includes(rule.ruleType) && rule.startsAt ? new Date(rule.startsAt).toISOString() : null,
        endsAt: ['blackout','available_window'].includes(rule.ruleType) && rule.endsAt ? new Date(rule.endsAt).toISOString() : null,
        capacityOverride: rule.ruleType === 'capacity_override' && rule.capacityOverride !== '' ? Number(rule.capacityOverride) : null,
        reason: rule.reason || null,
      })
      setMessage('Availability rule added.'); await loadItem(selected.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add availability rule.') }
    finally { setBusy('') }
  }

  async function removeRule(ruleId: string) {
    if (!selected) return
    setBusy(ruleId); setError(''); setMessage('')
    try { await request(`/api/vendor/catalog/${encodeURIComponent(selected.id)}/availability-rules?ruleId=${encodeURIComponent(ruleId)}`, 'DELETE'); setMessage('Availability rule removed.'); await loadItem(selected.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove availability rule.') }
    finally { setBusy('') }
  }

  async function addComponent() {
    if (!selected) return
    setBusy('component'); setError(''); setMessage('')
    try {
      await request(`/api/vendor/catalog/${encodeURIComponent(selected.id)}/components`, 'POST', {
        childCatalogItemId: component.childCatalogItemId,
        childVariantId: component.childVariantId || null,
        componentKind: component.componentKind,
        selectionKey: component.componentKind === 'addon' ? component.selectionKey : null,
        name: component.name,
        quantity: Number(component.quantity || 1),
        isOptional: component.isOptional,
      })
      setMessage('Resource-backed component added.'); setComponent((current) => ({...current,name:'',selectionKey:'',quantity:'1'})); await loadItem(selected.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add component.') }
    finally { setBusy('') }
  }

  async function removeComponent(componentId: string) {
    if (!selected) return
    setBusy(componentId); setError(''); setMessage('')
    try { await request(`/api/vendor/catalog/${encodeURIComponent(selected.id)}/components?componentId=${encodeURIComponent(componentId)}`, 'DELETE'); setMessage('Component removed.'); await loadItem(selected.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove component.') }
    finally { setBusy('') }
  }

  return <DashboardAuthGate allowedRoles={['vendor']} wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts." title="Availability & packages" description="Sign in as an approved Vendor owner to configure deterministic booking supply.">
    <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/vendor" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" /> Vendor workspace</Link><button onClick={() => void loadCatalog()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold"><RefreshCw className="size-4" /> Refresh</button></div>
        <section className="mt-5 rounded-3xl border border-gold/20 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-muted">Deterministic supply</p><h1 className="mt-2 font-serif text-4xl">Availability & packages</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-espresso/60">Define when real resources can be booked and which child resources a package or add-on consumes. Instant Book will fail closed when this configuration cannot prove supply.</p></section>
        {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}{message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}
        {loading ? <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-6"><Loader2 className="size-5 animate-spin" /> Loading catalogue…</div> : <>
          <label className="mt-6 block rounded-2xl border border-gold/20 bg-white p-4 text-sm font-semibold">Catalogue item<select value={itemId} onChange={(event) => setItemId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3">{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.bookingArchetype.replaceAll('_',' ')} · {item.status}</option>)}</select></label>
          {selected ? <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><CalendarRange className="size-5 text-gold-muted"/><h2 className="font-serif text-2xl">Booking policy</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Timezone<input value={policy.timezone} onChange={(e)=>setPolicy({...policy,timezone:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Minimum notice (minutes)<input inputMode="numeric" value={policy.minNoticeMinutes} onChange={(e)=>setPolicy({...policy,minNoticeMinutes:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Booking horizon (days)<input inputMode="numeric" value={policy.bookingHorizonDays} onChange={(e)=>setPolicy({...policy,bookingHorizonDays:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Minimum duration (minutes)<input inputMode="numeric" value={policy.minDurationMinutes} onChange={(e)=>setPolicy({...policy,minDurationMinutes:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Maximum duration (minutes)<input inputMode="numeric" value={policy.maxDurationMinutes} onChange={(e)=>setPolicy({...policy,maxDurationMinutes:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Service areas (comma separated)<input value={policy.serviceAreas} onChange={(e)=>setPolicy({...policy,serviceAreas:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label></div><button disabled={busy==='policy'} onClick={()=>void savePolicy()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-espresso px-4 text-sm font-bold text-champagne disabled:opacity-50">{busy==='policy'?<Loader2 className="size-4 animate-spin"/>:<RefreshCw className="size-4"/>}Save policy</button></section>

            <section className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm"><h2 className="font-serif text-2xl">Resource availability rules</h2>{selected.resources.length ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Resource<select value={rule.resourceId} onChange={(e)=>setRule({...rule,resourceId:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3">{selected.resources.map((resource)=><option key={resource.id} value={resource.id}>{resource.name} · capacity {resource.capacity}</option>)}</select></label><label className="text-sm font-semibold">Rule type<select value={rule.ruleType} onChange={(e)=>setRule({...rule,ruleType:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"><option value="weekly">Weekly hours</option><option value="blackout">Blackout</option><option value="available_window">Available window</option><option value="capacity_override">Capacity override</option></select></label>{rule.ruleType==='weekly'?<><label className="text-sm font-semibold">Day<select value={rule.dayOfWeek} onChange={(e)=>setRule({...rule,dayOfWeek:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3">{dayNames.map((day,index)=><option key={day} value={index}>{day}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm font-semibold">From<input type="time" value={rule.startTime} onChange={(e)=>setRule({...rule,startTime:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-2"/></label><label className="text-sm font-semibold">To<input type="time" value={rule.endTime} onChange={(e)=>setRule({...rule,endTime:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-2"/></label></div></>:null}{['blackout','available_window'].includes(rule.ruleType)?<><label className="text-sm font-semibold">Starts<input type="datetime-local" value={rule.startsAt} onChange={(e)=>setRule({...rule,startsAt:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-2"/></label><label className="text-sm font-semibold">Ends<input type="datetime-local" value={rule.endsAt} onChange={(e)=>setRule({...rule,endsAt:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-2"/></label></>:null}{rule.ruleType==='capacity_override'?<label className="text-sm font-semibold">Capacity<input inputMode="numeric" value={rule.capacityOverride} onChange={(e)=>setRule({...rule,capacityOverride:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label>:null}<label className="text-sm font-semibold sm:col-span-2">Reason<input value={rule.reason} onChange={(e)=>setRule({...rule,reason:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label></div><button disabled={busy==='rule'||!rule.resourceId} onClick={()=>void addRule()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-espresso px-4 text-sm font-bold text-champagne disabled:opacity-50">{busy==='rule'?<Loader2 className="size-4 animate-spin"/>:<Plus className="size-4"/>}Add rule</button></>:<p className="mt-3 text-sm text-amber-800">Create real resources in Catalogue before configuring deterministic availability.</p>}
              <div className="mt-4 space-y-2">{rules.map((entry)=><div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-ivory p-3 text-xs"><div><strong>{entry.resourceName}</strong> · {entry.ruleType.replaceAll('_',' ')}<div className="mt-1 text-espresso/55">{entry.dayOfWeek!=null?dayNames[entry.dayOfWeek]:''} {entry.startTime||''} {entry.endTime?`– ${entry.endTime}`:''} {entry.startsAt?new Date(entry.startsAt).toLocaleString():''} {entry.endsAt?`– ${new Date(entry.endsAt).toLocaleString()}`:''} {entry.capacityOverride!=null?`capacity ${entry.capacityOverride}`:''}</div></div><button onClick={()=>void removeRule(entry.id)} disabled={busy===entry.id} className="rounded-full border p-2 text-red-700 disabled:opacity-50"><Trash2 className="size-4"/></button></div>)}</div></section>

            <section className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center gap-2"><Layers3 className="size-5 text-gold-muted"/><h2 className="font-serif text-2xl">Package & resource-backed add-on components</h2></div><p className="mt-2 text-sm text-espresso/55">A package can reserve child catalogue resources. A resource-consuming add-on must use the same selection key exposed to customers.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Child item<select value={component.childCatalogItemId} onChange={(e)=>setComponent({...component,childCatalogItemId:e.target.value,childVariantId:''})} className="mt-1 min-h-10 w-full rounded-xl border px-3">{candidates.map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.category}</option>)}</select></label><label className="text-sm font-semibold">Component type<select value={component.componentKind} onChange={(e)=>setComponent({...component,componentKind:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"><option value="package">Package component</option><option value="addon">Resource-consuming add-on</option></select></label><label className="text-sm font-semibold">Quantity<input inputMode="numeric" value={component.quantity} onChange={(e)=>setComponent({...component,quantity:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Display name<input value={component.name} onChange={(e)=>setComponent({...component,name:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3"/></label>{component.componentKind==='addon'?<label className="text-sm font-semibold">Add-on selection key<input value={component.selectionKey} onChange={(e)=>setComponent({...component,selectionKey:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border px-3" placeholder="delivery"/></label>:null}<label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold"><input type="checkbox" checked={component.isOptional} onChange={(e)=>setComponent({...component,isOptional:e.target.checked})}/>Optional component</label></div><button disabled={busy==='component'||!component.childCatalogItemId||!component.name} onClick={()=>void addComponent()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-espresso px-4 text-sm font-bold text-champagne disabled:opacity-50">{busy==='component'?<Loader2 className="size-4 animate-spin"/>:<Plus className="size-4"/>}Add component</button><div className="mt-4 grid gap-2 md:grid-cols-2">{components.map((entry)=><div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-ivory p-3 text-xs"><div><strong>{entry.name}</strong><div className="mt-1 text-espresso/55">{entry.componentKind} · {entry.childItemName}{entry.childVariantName?` / ${entry.childVariantName}`:''} · × {entry.quantity}{entry.selectionKey?` · key ${entry.selectionKey}`:''}{entry.isOptional?' · optional':''}</div></div><button onClick={()=>void removeComponent(entry.id)} disabled={busy===entry.id} className="rounded-full border p-2 text-red-700 disabled:opacity-50"><Trash2 className="size-4"/></button></div>)}</div></section>
          </div> : null}
        </>}
      </div>
    </main>
  </DashboardAuthGate>
}
