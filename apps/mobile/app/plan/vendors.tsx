import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import type { PlannerVendor } from '@/lib/types'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

const categories = ['venue','caterer','photographer','videographer','florist','dj','decor','transport','stationery','other'] as const

type Vendor = PlannerVendor & { contractStatus?: string; paymentStatus?: string; contact?: string | null; metaRating?: number | null }

export default function VendorsScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const key = ['planner-vendors', session?.activeWedding?.id]
  const [name,setName]=useState(''); const [category,setCategory]=useState<(typeof categories)[number]>('photographer'); const [phone,setPhone]=useState(''); const [email,setEmail]=useState(''); const [contact,setContact]=useState(''); const [error,setError]=useState<string|null>(null)
  const query=useQuery({queryKey:key,enabled:Boolean(token&&session?.activeWedding),queryFn:()=>wewedRequest<{data:Vendor[]}>('/api/planner/vendors',{token})})
  const refresh=()=>queryClient.invalidateQueries({queryKey:key})
  const add=useMutation({mutationFn:()=>wewedRequest('/api/planner/vendors',{token,method:'POST',body:JSON.stringify({name:name.trim(),category,phone:phone.trim()||undefined,email:email.trim()||undefined,contact:contact.trim()||undefined,contractStatus:'pending',paymentStatus:'unpaid'})}),onSuccess:async()=>{setName('');setPhone('');setEmail('');setContact('');setError(null);await refresh()},onError:(cause)=>setError(cause instanceof WewedApiError?cause.message:'Vendor could not be saved.')})
  const remove=useMutation({mutationFn:(id:string)=>wewedRequest(`/api/planner/vendors/${id}`,{token,method:'DELETE'}),onSuccess:refresh,onError:(cause)=>Alert.alert('Vendor kept',cause instanceof WewedApiError?cause.message:'This vendor could not be removed.')})
  return <Screen>
    <View style={styles.header}><Eyebrow>Plan · Vendors</Eyebrow><Title>Your wedding team.</Title><Body muted>Keep the people delivering the wedding close to their contract, payment and contact state.</Body></View>
    <Surface>
      <View style={styles.titleRow}><View style={styles.flexOne}><Text style={styles.sectionTitle}>Add known vendor</Text><Body muted>Already working with someone? Put them into the wedding plan.</Body></View><ActionButton label="Discover" variant="quiet" onPress={()=>router.push('/(tabs)/marketplace')} /></View>
      <Field label="Business name" value={name} onChangeText={setName} placeholder="Shandy Events" />
      <Field label="Contact person" value={contact} onChangeText={setContact} placeholder="Optional" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Optional" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" />
      <Text style={styles.label}>Category</Text><View style={styles.chips}>{categories.map(value=><Chip key={value} label={pretty(value)} active={category===value} onPress={()=>setCategory(value)} />)}</View>
      {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
      <ActionButton label="Add vendor" loading={add.isPending} onPress={async()=>{if(!name.trim()){setError('Business name is required.');return}add.mutate()}} />
    </Surface>
    <Surface>
      <Text style={styles.sectionTitle}>Wedding vendors</Text><Body muted>{query.data?.data.length??0} vendors linked to this wedding</Body>
      {query.isLoading?<Body muted>Loading vendors…</Body>:null}
      {(query.data?.data??[]).map(vendor=><View key={vendor.id} style={styles.vendor}>
        <View style={styles.titleRow}><View style={styles.flexOne}><Text style={styles.vendorName}>{vendor.name}</Text><Text style={styles.meta}>{pretty(vendor.category)}{vendor.contact?` · ${vendor.contact}`:''}</Text></View><Pill tone={vendor.contractStatus==='signed'?'sage':vendor.contractStatus==='declined'?'plum':'gold'}>{pretty(vendor.contractStatus||'pending')}</Pill></View>
        <View style={styles.statusRow}><Text style={styles.meta}>Payment</Text><Pill tone={vendor.paymentStatus==='paid'?'sage':vendor.paymentStatus==='deposit'?'gold':'clay'}>{pretty(vendor.paymentStatus||'unpaid')}</Pill></View>
        {vendor.phone?<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL(`tel:${vendor.phone}`)} style={styles.action}><Text style={styles.actionText}>Call {vendor.phone}</Text></Pressable>:null}
        {vendor.email?<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL(`mailto:${vendor.email}`)} style={styles.action}><Text style={styles.actionText}>Email {vendor.email}</Text></Pressable>:null}
        <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Remove vendor?',vendor.name,[{text:'Keep',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>remove.mutate(vendor.id)}])} style={styles.action}><Text style={styles.deleteText}>Remove from wedding</Text></Pressable>
      </View>)}
    </Surface>
  </Screen>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={({pressed})=>[styles.chip,active&&styles.chipActive,pressed&&{opacity:.6}]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
function pretty(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
const styles=StyleSheet.create({header:{gap:spacing.xs},titleRow:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},sectionTitle:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},label:{color:colors.espresso,fontSize:13,fontWeight:'700'},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{minHeight:minimumTouchTarget,justifyContent:'center',paddingHorizontal:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.espresso,borderColor:colors.espresso},chipText:{color:colors.inkMuted,fontSize:12,fontWeight:'700'},chipTextActive:{color:colors.goldLight},vendor:{gap:spacing.sm,paddingTop:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},vendorName:{color:colors.espresso,fontSize:17,fontWeight:'800'},meta:{color:colors.inkMuted,fontSize:12,lineHeight:17},statusRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm},action:{minHeight:minimumTouchTarget,justifyContent:'center',alignSelf:'flex-start'},actionText:{color:colors.goldMuted,fontSize:13,fontWeight:'800'},deleteText:{color:colors.danger,fontSize:13,fontWeight:'800'},error:{color:colors.danger,fontSize:13},flexOne:{flex:1}})
