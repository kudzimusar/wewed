import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request:NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const [payments,funding,contributions] = await Promise.all([
      db.engagementPayment.findMany({ where:{ serviceEngagement:{ weddingId } }, select:{ id:true, amount:true, currency:true, serviceEngagement:{ select:{ id:true, vendorId:true } } } }),
      db.$queryRaw<Array<{ paymentId:string|null; sourceKind:string; amount:string; currency:string; vendorId:string|null }>>`
        SELECT f.payment_id AS "paymentId", f.source_kind AS "sourceKind", f.amount::text AS amount, f.currency, se."vendorId" AS "vendorId"
          FROM wewed_contributions.payment_funding_allocations f
          LEFT JOIN public."EngagementPayment" p ON p.id=f.payment_id
          LEFT JOIN public."ServiceEngagement" se ON se.id=p."serviceEngagementId"
         WHERE f.wedding_id=${weddingId} AND f.payment_id IS NOT NULL
      `,
      db.$queryRaw<Array<{ vendorId:string|null; serviceEngagementId:string|null; type:string; amount:string|null; currency:string; estimatedValue:string|null; estimatedValueCurrency:string|null; commitmentState:string; fulfillmentState:string }>>`
        SELECT c.vendor_id AS "vendorId", c.service_engagement_id AS "serviceEngagementId", c.type, c.amount::text AS amount, c.currency,
               c.estimated_value::text AS "estimatedValue", c.estimated_value_currency AS "estimatedValueCurrency",
               c.commitment_state AS "commitmentState", c.fulfillment_state AS "fulfillmentState"
          FROM wewed_contributions.wedding_contributions c
         WHERE c.wedding_id=${weddingId} AND (c.vendor_id IS NOT NULL OR c.service_engagement_id IS NOT NULL)
      `,
    ])
    const engagementVendor = new Map(payments.map((payment)=>[payment.serviceEngagement.id,payment.serviceEngagement.vendorId]))
    const vendorIds = new Set<string>()
    payments.forEach((payment)=>vendorIds.add(payment.serviceEngagement.vendorId))
    contributions.forEach((item)=>{ const vendorId=item.vendorId ?? (item.serviceEngagementId ? engagementVendor.get(item.serviceEngagementId) : null); if(vendorId) vendorIds.add(vendorId) })
    const data = Array.from(vendorIds).map((vendorId)=>{
      const vendorPayments = payments.filter((payment)=>payment.serviceEngagement.vendorId===vendorId)
      const paymentBuckets = new Map<string,{currency:string;paid:number;contributor:number;couple:number;other:number;unattributed:number}>()
      for (const payment of vendorPayments) {
        const bucket = paymentBuckets.get(payment.currency) ?? { currency:payment.currency, paid:0, contributor:0, couple:0, other:0, unattributed:0 }
        const amount = Number(payment.amount); bucket.paid += amount
        const rows = funding.filter((row)=>row.paymentId===payment.id && row.currency===payment.currency)
        const classified = rows.filter((row)=>row.sourceKind!=='LEGACY_UNATTRIBUTED').reduce((sum,row)=>sum+Number(row.amount),0)
        bucket.contributor += rows.filter((row)=>row.sourceKind==='CONTRIBUTION').reduce((sum,row)=>sum+Number(row.amount),0)
        bucket.couple += rows.filter((row)=>row.sourceKind==='COUPLE').reduce((sum,row)=>sum+Number(row.amount),0)
        bucket.other += rows.filter((row)=>row.sourceKind==='OTHER').reduce((sum,row)=>sum+Number(row.amount),0)
        bucket.unattributed += Math.max(0,amount-classified)
        paymentBuckets.set(payment.currency,bucket)
      }
      const vendorContributions = contributions.filter((item)=>item.vendorId===vendorId || (item.serviceEngagementId && engagementVendor.get(item.serviceEngagementId)===vendorId))
      const pledgedByCurrency:Record<string,number> = {}
      const inKindByCurrency:Record<string,number> = {}
      for (const item of vendorContributions) {
        if (item.type==='DIRECT_VENDOR_PAYMENT' && item.commitmentState==='PLEDGED' && item.fulfillmentState==='PENDING' && item.amount) pledgedByCurrency[item.currency]=(pledgedByCurrency[item.currency]??0)+Number(item.amount)
        if (['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(item.type) && ['DELIVERED','COMPLETED'].includes(item.fulfillmentState) && item.estimatedValue) { const currency=item.estimatedValueCurrency ?? item.currency; inKindByCurrency[currency]=(inKindByCurrency[currency]??0)+Number(item.estimatedValue) }
      }
      return { vendorId, paymentFunding:Array.from(paymentBuckets.values()), pledgedDirect:Object.entries(pledgedByCurrency).map(([currency,amount])=>({currency,amount})), inKind:Object.entries(inKindByCurrency).map(([currency,amount])=>({currency,amount})) }
    })
    return NextResponse.json({ success:true, data })
  } catch (error) {
    console.error('[VENDOR CONTRIBUTION FUNDING SUMMARY] error', error)
    return NextResponse.json({ success:false, error:'Could not load vendor funding context.' }, { status:500 })
  }
}
