'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Boxes, ImagePlus, Loader2, PackagePlus, Plus, QrCode, RefreshCw, Shirt, Video } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type Offering = { id: string; category: string; displayName: string; status: string; pricingVisibility?: string; startingPriceCents?: number | null; currency?: string }
type Variant = { id: string; sku: string; name: string; optionValues: Record<string, unknown>; status: string; priceOverrideCents?: number | null; inventoryMode: string }
type Media = { id: string; variantId?: string | null; type: string; url: string; altText?: string; caption?: string; isPublished: boolean }
type Resource = { id: string; variantId?: string | null; name: string; resourceType: string; serialReference?: string | null; capacity: number; status: string }
type Item = {
  id: string; offeringId: string; category: string; offeringName: string; slug: string; name: string; description?: string | null
  bookingArchetype: string; bookingMode: string; status: string; basePriceCents?: number | null; currency: string; minQuantity?: number | null; maxQuantity?: number | null
  requiresFitting: boolean; requiresContract: boolean; variants: Variant[]; media: Media[]; resources: Resource[]
}
type CatalogData = { business: { businessAccountId: string; businessName: string }; offerings: Offering[]; items: Item[] }

const archetypes = [
  ['individual_rental','Individual rental'],['quantity_rental','Quantity rental'],['appointment','Appointment'],['timed_service','Timed service'],
  ['event_day_service','Event-day service'],['capacity','Venue/capacity'],['transport','Transport'],['package','Package'],['custom','Custom/quote'],['hybrid','Hybrid rental + appointment'],
] as const
const modes = [['request','Request to book'],['quote','Request quote'],['instant','Instant Book'],['appointment','Schedule appointment'],['plan_only','Add to plan only']] as const

function dollarsToCents(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : NaN
}

function money(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return 'Price not set'
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(cents/100) } catch { return `${currency} ${(cents/100).toFixed(2)}` }
}

export default function VendorCatalogPage() {
  const [data,setData] = useState<CatalogData | null>(null)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState('')
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [newItem,setNewItem] = useState({ offeringId:'',name:'',description:'',bookingArchetype:'hybrid',bookingMode:'quote',price:'',currency:'USD',status:'published',minQuantity:'1',maxQuantity:'',requiresFitting:false,requiresContract:true })
  const [assetItem,setAssetItem] = useState('')
  const [variant,setVariant] = useState({name:'',sku:'',size:'',colour:'',inventoryMode:'serialized',price:''})
  const [resource,setResource] = useState({name:'',resourceType:'item',capacity:'1',variantId:'',serialReference:''})
  const [media,setMedia] = useState({type:'image',url:'',altText:'',caption:'',variantId:''})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response=await fetch('/api/vendor/catalog',{cache:'no-store'})
      const payload=await response.json()
      if(!response.ok||!payload.success) throw new Error(payload.error||'Unable to load catalogue.')
      setData(payload.data)
      setNewItem((current)=>({...current,offeringId:current.offeringId||payload.data.offerings?.[0]?.id||''}))
      setAssetItem((current)=>current||payload.data.items?.[0]?.id||'')
    } catch(reason){setError(reason instanceof Error?reason.message:'Unable to load catalogue.')} finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])

  const activeItem=useMemo(()=>data?.items.find((item)=>item.id===assetItem)||null,[data,assetItem])

  async function createItem(){
    setBusy('item');setError('');setMessage('')
    try{
      const price=dollarsToCents(newItem.price)
      if(Number.isNaN(price)) throw new Error('Enter a valid price or leave it blank for a quote-only item.')
      const response=await fetch('/api/vendor/catalog',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        offeringId:newItem.offeringId,name:newItem.name,description:newItem.description,bookingArchetype:newItem.bookingArchetype,bookingMode:newItem.bookingMode,
        basePriceCents:price,currency:newItem.currency,status:newItem.status,minQuantity:Number(newItem.minQuantity||1),maxQuantity:newItem.maxQuantity?Number(newItem.maxQuantity):null,
        requiresFitting:newItem.requiresFitting,requiresContract:newItem.requiresContract,
      })})
      const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error||'Unable to create item.')
      setMessage('Catalogue item created. Add real variants, media and inventory below.');setNewItem((current)=>({...current,name:'',description:'',price:''}));await load()
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to create item.')}finally{setBusy('')}
  }

  async function asset(action:string,body:Record<string,unknown>){
    if(!assetItem)return
    setBusy(action);setError('');setMessage('')
    try{
      const response=await fetch(`/api/vendor/catalog/${encodeURIComponent(assetItem)}/assets`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...body})})
      const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error||'Unable to update catalogue.')
      setMessage('Catalogue updated.');await load()
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to update catalogue.')}finally{setBusy('')}
  }

  async function addVariant(){
    const price=dollarsToCents(variant.price);if(Number.isNaN(price)){setError('Variant price is invalid.');return}
    await asset('variant.create',{name:variant.name,sku:variant.sku,inventoryMode:variant.inventoryMode,priceOverrideCents:price,optionValues:{size:variant.size||undefined,colour:variant.colour||undefined}})
    setVariant((current)=>({...current,name:'',sku:'',size:'',colour:'',price:''}))
  }
  async function addResource(){await asset('resource.create',{...resource,capacity:Number(resource.capacity||1),variantId:resource.variantId||null});setResource((current)=>({...current,name:'',capacity:'1',serialReference:''}))}
  async function addMedia(){await asset('media.create',{...media,variantId:media.variantId||null,isPublished:true});setMedia((current)=>({...current,url:'',altText:'',caption:''}))}

  return <DashboardAuthGate allowedRoles={['vendor']} wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts." title="Vendor catalogue" description="Sign in as an approved Vendor owner to manage bookable services.">
    <main className="min-h-dvh bg-ivory px-4 py-7 text-espresso sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 rounded-3xl border border-gold/20 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div><Link href="/vendor" className="inline-flex items-center gap-2 text-sm font-semibold text-espresso/60"><ArrowLeft className="size-4"/>Vendor workspace</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-gold-muted">Commerce catalogue</p><h1 className="mt-2 font-serif text-4xl">What customers can book</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-espresso/60">Add real products and services, variants such as gown size and colour, photos or video, and the exact inventory Wewed may reserve. Do not publish guessed prices or stock.</p></div>
          <button onClick={()=>void load()} type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold"><RefreshCw className="size-4"/>Refresh</button>
        </div>

        {error&&<div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}{message&&<div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
        {loading?<div className="mt-6 flex items-center gap-2 rounded-3xl border bg-white p-6"><Loader2 className="size-5 animate-spin"/>Loading catalogue…</div>:data&&<>
          <section className="mt-6 rounded-3xl border border-gold/20 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2"><PackagePlus className="size-5 text-gold-muted"/><h2 className="font-serif text-2xl">Create bookable item</h2></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold">Service offering<select className="mt-1.5 min-h-11 w-full rounded-xl border px-3" value={newItem.offeringId} onChange={(e)=>setNewItem({...newItem,offeringId:e.target.value})}>{data.offerings.map((offering)=><option key={offering.id} value={offering.id}>{offering.displayName} ({offering.category})</option>)}</select></label>
              <label className="text-sm font-semibold">Item / service name<input className="mt-1.5 min-h-11 w-full rounded-xl border px-3" value={newItem.name} onChange={(e)=>setNewItem({...newItem,name:e.target.value})} placeholder="Royal Lace gown"/></label>
              <label className="text-sm font-semibold">Booking type<select className="mt-1.5 min-h-11 w-full rounded-xl border px-3" value={newItem.bookingArchetype} onChange={(e)=>setNewItem({...newItem,bookingArchetype:e.target.value})}>{archetypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-semibold">Customer action<select className="mt-1.5 min-h-11 w-full rounded-xl border px-3" value={newItem.bookingMode} onChange={(e)=>setNewItem({...newItem,bookingMode:e.target.value})}>{modes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-semibold">Verified base price (optional)<div className="mt-1.5 flex"><span className="flex items-center rounded-l-xl border border-r-0 px-3 text-xs">{newItem.currency}</span><input className="min-h-11 min-w-0 flex-1 rounded-r-xl border px-3" inputMode="decimal" value={newItem.price} onChange={(e)=>setNewItem({...newItem,price:e.target.value})} placeholder="300.00"/></div></label>
              <label className="text-sm font-semibold">Publish state<select className="mt-1.5 min-h-11 w-full rounded-xl border px-3" value={newItem.status} onChange={(e)=>setNewItem({...newItem,status:e.target.value})}><option value="published">Published</option><option value="draft">Draft</option></select></label>
            </div>
            <label className="mt-4 block text-sm font-semibold">Description<textarea rows={3} className="mt-1.5 w-full rounded-xl border p-3" value={newItem.description} onChange={(e)=>setNewItem({...newItem,description:e.target.value})} placeholder="What is included, how hire works, what the customer should know…"/></label>
            <div className="mt-4 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={newItem.requiresFitting} onChange={(e)=>setNewItem({...newItem,requiresFitting:e.target.checked})}/>Fitting / appointment required</label><label className="flex items-center gap-2"><input type="checkbox" checked={newItem.requiresContract} onChange={(e)=>setNewItem({...newItem,requiresContract:e.target.checked})}/>Agreement required</label></div>
            {newItem.bookingMode==='instant'&&<div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Instant Book safety:</strong> Wewed requires a deterministic price here and configured resources below before it can reserve inventory. Otherwise use Request to Book or Request Quote.</div>}
            <button disabled={busy==='item'||!newItem.name||!newItem.offeringId} onClick={()=>void createItem()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-espresso px-5 text-sm font-bold text-champagne disabled:opacity-50">{busy==='item'?<Loader2 className="size-4 animate-spin"/>:<Plus className="size-4"/>}Create item</button>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {data.items.map((item)=><article key={item.id} className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wider text-gold-muted">{item.category} · {item.bookingMode.replaceAll('_',' ')}</div><h2 className="mt-2 font-serif text-2xl">{item.name}</h2><p className="mt-1 text-sm text-espresso/60">{money(item.basePriceCents,item.currency)} · {item.status}</p></div><span className="rounded-full bg-champagne px-3 py-1 text-xs font-semibold">{item.bookingArchetype.replaceAll('_',' ')}</span></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-ivory p-2"><strong className="block text-lg">{item.variants.length}</strong>variants</div><div className="rounded-xl bg-ivory p-2"><strong className="block text-lg">{item.resources.length}</strong>resources</div><div className="rounded-xl bg-ivory p-2"><strong className="block text-lg">{item.media.length}</strong>media</div></div>
              <button onClick={()=>setAssetItem(item.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold">Manage details</button>
            </article>)}
          </section>

          {activeItem&&<section className="mt-6 rounded-3xl border-2 border-gold/30 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-muted">Inventory builder</p><h2 className="mt-1 font-serif text-3xl">{activeItem.name}</h2></div><select value={assetItem} onChange={(e)=>setAssetItem(e.target.value)} className="min-h-11 rounded-xl border px-3">{data.items.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <div className="rounded-2xl border p-4"><div className="flex items-center gap-2"><Shirt className="size-5"/><h3 className="font-semibold">Variants</h3></div><p className="mt-1 text-xs text-espresso/55">Sizes, colours, models or finishes. Each can have its own price and inventory.</p><div className="mt-3 grid gap-2"><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Variant name" value={variant.name} onChange={(e)=>setVariant({...variant,name:e.target.value})}/><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="SKU / reference" value={variant.sku} onChange={(e)=>setVariant({...variant,sku:e.target.value})}/><div className="grid grid-cols-2 gap-2"><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Size" value={variant.size} onChange={(e)=>setVariant({...variant,size:e.target.value})}/><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Colour" value={variant.colour} onChange={(e)=>setVariant({...variant,colour:e.target.value})}/></div><select className="min-h-10 rounded-xl border px-3 text-sm" value={variant.inventoryMode} onChange={(e)=>setVariant({...variant,inventoryMode:e.target.value})}><option value="serialized">Individual / serialized</option><option value="pooled">Quantity pool</option><option value="capacity">Capacity</option><option value="time_slot">Time slot</option><option value="none">No inventory</option></select><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Price override, e.g. 350.00" value={variant.price} onChange={(e)=>setVariant({...variant,price:e.target.value})}/><button disabled={busy==='variant.create'||!variant.name||!variant.sku} onClick={()=>void addVariant()} className="min-h-10 rounded-xl bg-espresso px-3 text-sm font-semibold text-white disabled:opacity-50">Add variant</button></div>
                {activeItem.variants.length>0&&<div className="mt-3 space-y-2 text-xs">{activeItem.variants.map((entry)=><div key={entry.id} className="rounded-xl bg-ivory p-2"><strong>{entry.name}</strong> · {entry.sku}<div className="text-espresso/55">{Object.values(entry.optionValues||{}).filter(Boolean).join(' / ')||entry.inventoryMode}</div></div>)}</div>}
              </div>
              <div className="rounded-2xl border p-4"><div className="flex items-center gap-2"><Boxes className="size-5"/><h3 className="font-semibold">Bookable resources</h3></div><p className="mt-1 text-xs text-espresso/55">Create actual stock/capacity. Wewed only uses configured resources for Instant Book.</p><div className="mt-3 grid gap-2"><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Resource name" value={resource.name} onChange={(e)=>setResource({...resource,name:e.target.value})}/><select className="min-h-10 rounded-xl border px-3 text-sm" value={resource.variantId} onChange={(e)=>setResource({...resource,variantId:e.target.value})}><option value="">All variants / item level</option>{activeItem.variants.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><select className="min-h-10 rounded-xl border px-3 text-sm" value={resource.resourceType} onChange={(e)=>setResource({...resource,resourceType:e.target.value})}><option value="item">Individual item</option><option value="pool">Quantity pool</option><option value="staff">Staff</option><option value="team">Team</option><option value="vehicle">Vehicle</option><option value="venue">Venue</option><option value="space">Space</option><option value="capacity">Capacity</option><option value="slot">Slot</option><option value="other">Other</option></select><input className="min-h-10 rounded-xl border px-3 text-sm" type="number" min="1" placeholder="Capacity" value={resource.capacity} onChange={(e)=>setResource({...resource,capacity:e.target.value})}/><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Serial/reference (optional)" value={resource.serialReference} onChange={(e)=>setResource({...resource,serialReference:e.target.value})}/><button disabled={busy==='resource.create'||!resource.name} onClick={()=>void addResource()} className="min-h-10 rounded-xl bg-espresso px-3 text-sm font-semibold text-white disabled:opacity-50">Add resource</button></div>
                {activeItem.resources.length>0&&<div className="mt-3 space-y-2 text-xs">{activeItem.resources.map((entry)=><div key={entry.id} className="rounded-xl bg-ivory p-2"><strong>{entry.name}</strong> · capacity {entry.capacity}<div className="text-espresso/55">{entry.resourceType}{entry.serialReference?` · ${entry.serialReference}`:''}</div></div>)}</div>}
              </div>
              <div className="rounded-2xl border p-4"><div className="flex items-center gap-2">{media.type==='video'?<Video className="size-5"/>:<ImagePlus className="size-5"/>}<h3 className="font-semibold">Gallery & video</h3></div><p className="mt-1 text-xs text-espresso/55">Publish real media that helps couples choose. HTTPS URLs are supported in this manager.</p><div className="mt-3 grid gap-2"><select className="min-h-10 rounded-xl border px-3 text-sm" value={media.type} onChange={(e)=>setMedia({...media,type:e.target.value})}><option value="image">Image</option><option value="video">Video</option></select><select className="min-h-10 rounded-xl border px-3 text-sm" value={media.variantId} onChange={(e)=>setMedia({...media,variantId:e.target.value})}><option value="">Item-level media</option>{activeItem.variants.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="https://…" value={media.url} onChange={(e)=>setMedia({...media,url:e.target.value})}/><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Accessible description" value={media.altText} onChange={(e)=>setMedia({...media,altText:e.target.value})}/><input className="min-h-10 rounded-xl border px-3 text-sm" placeholder="Caption (optional)" value={media.caption} onChange={(e)=>setMedia({...media,caption:e.target.value})}/><button disabled={busy==='media.create'||!media.url} onClick={()=>void addMedia()} className="min-h-10 rounded-xl bg-espresso px-3 text-sm font-semibold text-white disabled:opacity-50">Publish media</button></div>
                {activeItem.media.length>0&&<div className="mt-3 grid grid-cols-3 gap-2">{activeItem.media.map((entry)=><div key={entry.id} title={entry.caption||entry.altText||entry.type} className="aspect-square overflow-hidden rounded-xl bg-ivory">{entry.type==='video'?<div className="flex h-full items-center justify-center text-xs"><Video className="size-4"/></div>:/* eslint-disable-next-line @next/next/no-img-element */<img src={entry.url} alt={entry.altText||''} className="h-full w-full object-cover"/>}</div>)}</div>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/vendor/bookings" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold">View bookings</Link><Link href="/vendors/manage" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold">Edit public profile</Link><span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-champagne px-4 text-sm"><QrCode className="size-4"/>QR sharing appears automatically on the public profile.</span></div>
          </section>}
        </>}
      </div>
    </main>
  </DashboardAuthGate>
}
