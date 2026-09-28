import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

type ContributionType = 'CASH_TO_COUPLE'|'HONEYMOON_GIFT'|'GOODS_IN_KIND'|'SERVICE_IN_KIND'|'TIME_LABOUR'|'DISCOUNT_SPONSORSHIP'
type Contribution = {
  id:string; type:string; title:string; description:string|null; amount:number|null; currency:string; estimatedValue:number|null; estimatedValueCurrency:string|null;
  commitmentState:string; fulfillmentState:string; verificationState:string; thankYouState:string; availableAmount:number; allocatedAmount:number;
  contributor:{id:string;displayName:string;email:string|null;relationship:string|null}; vendor:{id:string;name:string}|null; createdAt:string
}
type ContributionWorkspace = {
  data:Contribution[]
  summaryByCurrency:Array<{currency:string;cashReceived:number;directVendorPaid:number;inKindValue:number;pledged:number;availableCash:number}>
  counts:{contributors:number;pledged:number;toThank:number}
  permissions:{canEdit:boolean;canCreateTasks:boolean}
  options:{budgetItems:Array<{id:string;description:string;category:string;currency:string}>}
}

const types:Array<{value:ContributionType;label:string}>=[
  {value:'CASH_TO_COUPLE',label:'Money to us'},
  {value:'HONEYMOON_GIFT',label:'Honeymoon gift'},
  {value:'GOODS_IN_KIND',label:'Goods'},
  {value:'SERVICE_IN_KIND',label:'Service'},
  {value:'TIME_LABOUR',label:'Time / help'},
  {value:'DISCOUNT_SPONSORSHIP',label:'Discount / sponsor'},
]

export default function ContributionsScreen(){
  const {token,session}=useSession(); const queryClient=useQueryClient(); const key=['planner-contributions',session?.activeWedding?.id]
  const [type,setType]=useState<ContributionType>('CASH_TO_COUPLE'); const [contributor,setContributor]=useState(''); const [relationship,setRelationship]=useState(''); const [title,setTitle]=useState(''); const [amount,setAmount]=useState(''); const [currency,setCurrency]=useState('USD'); const [received,setReceived]=useState(true); const [budgetItemId,setBudgetItemId]=useState(''); const [error,setError]=useState<string|null>(null)
  const query=useQuery({queryKey:key,enabled:Boolean(token&&session?.activeWedding),queryFn:()=>wewedRequest<ContributionWorkspace>('/api/planner/contributions',{token})})
  const refresh=()=>queryClient.invalidateQueries({queryKey:key})
  const inKind=['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(type)
  const add=useMutation({mutationFn:()=>wewedRequest('/api/planner/contributions',{token,method:'POST',body:JSON.stringify({
    type,title:title.trim(),currency:currency.trim().toUpperCase()||'USD',amount:inKind?null:Number(amount)||0,estimatedValue:inKind?(Number(amount)||0):null,estimatedValueCurrency:inKind?(currency.trim().toUpperCase()||'USD'):null,
    commitmentState:received?'CONFIRMED':'PLEDGED',fulfillmentState:received?(inKind?'DELIVERED':'RECEIVED'):'PENDING',verificationState:'UNVERIFIED',thankYouState:received?'TO_THANK':'NOT_DUE',
    route:inKind?'IN_KIND_TO_COUPLE':'TO_COUPLE',budgetItemId:budgetItemId||null,contributor:{displayName:contributor.trim(),relationship:relationship.trim()||null,kind:'individual'}
  })}),onSuccess:async()=>{setContributor('');setRelationship('');setTitle('');setAmount('');setBudgetItemId('');setError(null);await refresh()},onError:(cause)=>setError(cause instanceof WewedApiError?cause.message:'Contribution could not be saved.')})

  return <Screen>
    <View style={styles.header}><Eyebrow>Plan · Contributions</Eyebrow><Title>Give credit where it belongs.</Title><Body muted>Record help from family, friends and organisations without making Wewed pretend the couple paid for everything themselves.</Body></View>
    <View style={styles.metrics}><Metric label="Contributors" value={query.data?.counts.contributors??0} tone="gold"/><Metric label="Pledged" value={query.data?.counts.pledged??0} tone="clay"/><Metric label="To thank" value={query.data?.counts.toThank??0} tone="sage"/></View>
    {(query.data?.summaryByCurrency??[]).map(summary=><Surface key={summary.currency}><View style={styles.titleRow}><Text style={styles.currency}>{summary.currency}</Text><Pill tone="gold">Funding picture</Pill></View><MoneyRow label="Received by couple" value={summary.cashReceived} currency={summary.currency}/><MoneyRow label="Paid directly to vendors" value={summary.directVendorPaid} currency={summary.currency}/><MoneyRow label="In-kind value" value={summary.inKindValue} currency={summary.currency}/><MoneyRow label="Still pledged" value={summary.pledged} currency={summary.currency}/><MoneyRow label="Cash not yet allocated" value={summary.availableCash} currency={summary.currency}/></Surface>)}
    {query.data?.permissions.canEdit?<Surface>
      <Text style={styles.sectionTitle}>Record contribution</Text><Body muted>Use this quick path for cash, gifts and in-kind help. Direct vendor payments use the governed payment workflow and are shown in the ledger below.</Body>
      <Text style={styles.label}>What kind of help?</Text><View style={styles.chips}>{types.map(item=><Chip key={item.value} label={item.label} active={type===item.value} onPress={()=>setType(item.value)}/>)}</View>
      <Field label="Contributor" value={contributor} onChangeText={setContributor} placeholder="Name or organisation"/><Field label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="Aunt, friend, employer…"/><Field label="What did they contribute?" value={title} onChangeText={setTitle} placeholder={inKind?'Wedding cake ingredients':'Venue contribution'}/>
      <View style={styles.amountRow}><View style={styles.flexOne}><Field label={inKind?'Estimated value':'Amount'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0"/></View><View style={styles.currencyField}><Field label="Currency" value={currency} onChangeText={v=>setCurrency(v.toUpperCase().slice(0,3))}/></View></View>
      <Text style={styles.label}>Status</Text><View style={styles.chips}><Chip label="Received / delivered" active={received} onPress={()=>setReceived(true)}/><Chip label="Pledged" active={!received} onPress={()=>setReceived(false)}/></View>
      {query.data.options.budgetItems.length?<><Text style={styles.label}>Budget link (optional)</Text><View style={styles.chips}><Chip label="Not allocated" active={!budgetItemId} onPress={()=>setBudgetItemId('')}/>{query.data.options.budgetItems.slice(0,10).map(item=><Chip key={item.id} label={item.description} active={budgetItemId===item.id} onPress={()=>setBudgetItemId(item.id)}/>)}</View></>:null}
      {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}<ActionButton label="Record contribution" loading={add.isPending} onPress={async()=>{if(!contributor.trim()){setError('Contributor name is required.');return}if(!title.trim()){setError('Describe what was contributed.');return}if((Number(amount)||0)<=0){setError(inKind?'Enter an estimated value.':'Enter the contribution amount.');return}add.mutate()}}/>
    </Surface>:null}
    <Surface><Text style={styles.sectionTitle}>Contribution ledger</Text>{query.isLoading?<Body muted>Loading contributions…</Body>:null}{(query.data?.data??[]).map(item=><View key={item.id} style={styles.item}><View style={styles.titleRow}><View style={styles.flexOne}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{item.contributor.displayName}{item.contributor.relationship?` · ${item.contributor.relationship}`:''}</Text></View><Pill tone={['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)?'sage':item.commitmentState==='PLEDGED'?'gold':'clay'}>{pretty(item.fulfillmentState)}</Pill></View><Text style={styles.value}>{money(item.amount??item.estimatedValue??0,item.amount!=null?item.currency:(item.estimatedValueCurrency??item.currency))}</Text><Text style={styles.meta}>{pretty(item.type)} · {pretty(item.verificationState)} · {pretty(item.thankYouState)}</Text>{item.availableAmount>0?<Text style={styles.available}>{money(item.availableAmount,item.currency)} available to allocate</Text>:null}</View>)}</Surface>
  </Screen>
}
function Metric({label,value,tone}:{label:string;value:number;tone:'gold'|'clay'|'sage'}){const c=tone==='clay'?colors.clay:tone==='sage'?colors.sage:colors.gold;return <View style={styles.metric}><View style={[styles.metricLine,{backgroundColor:c}]}/><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>}
function MoneyRow({label,value,currency}:{label:string;value:number;currency:string}){return <View style={styles.moneyRow}><Text style={styles.meta}>{label}</Text><Text style={styles.strong}>{money(value,currency)}</Text></View>}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={({pressed})=>[styles.chip,active&&styles.chipActive,pressed&&{opacity:.6}]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
function pretty(v:string){return v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())} function money(v:number,c='USD'){try{return new Intl.NumberFormat('en',{style:'currency',currency:c,maximumFractionDigits:0}).format(v)}catch{return `${c} ${Math.round(v).toLocaleString()}`}}
const styles=StyleSheet.create({header:{gap:spacing.xs},metrics:{flexDirection:'row',gap:spacing.xs},metric:{flex:1,minHeight:92,backgroundColor:colors.white,borderRadius:radius.lg,borderColor:colors.border,borderWidth:StyleSheet.hairlineWidth,padding:spacing.sm,overflow:'hidden'},metricLine:{position:'absolute',left:0,top:0,bottom:0,width:4},metricValue:{fontFamily:'serif',fontSize:26,fontWeight:'600',color:colors.espresso},metricLabel:{fontSize:11,fontWeight:'700',color:colors.inkMuted},titleRow:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},currency:{fontFamily:'serif',fontSize:24,fontWeight:'600',color:colors.espresso},moneyRow:{flexDirection:'row',justifyContent:'space-between',gap:spacing.sm},strong:{color:colors.espresso,fontSize:13,fontWeight:'800'},sectionTitle:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},label:{color:colors.espresso,fontSize:13,fontWeight:'700'},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{minHeight:minimumTouchTarget,justifyContent:'center',paddingHorizontal:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.espresso,borderColor:colors.espresso},chipText:{color:colors.inkMuted,fontSize:12,fontWeight:'700'},chipTextActive:{color:colors.goldLight},amountRow:{flexDirection:'row',gap:spacing.sm},currencyField:{width:100},item:{gap:5,paddingTop:spacing.md,borderTopColor:colors.border,borderTopWidth:StyleSheet.hairlineWidth},itemTitle:{color:colors.espresso,fontSize:16,fontWeight:'800'},meta:{color:colors.inkMuted,fontSize:12,lineHeight:17},value:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},available:{color:colors.sage,fontSize:12,fontWeight:'800'},error:{color:colors.danger,fontSize:13},flexOne:{flex:1}})
