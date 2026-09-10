import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, radius, spacing } from '@/theme/tokens'

type Message={id:string;body:string;senderUserId:string|null;senderName:string|null;senderRole:string|null;messageType:string;visibility:string;createdAt:string;editedAt:string|null;attachments?:Array<{id:string;fileName?:string}>}
type Conversation={id:string;title:string|null;participants:Array<{userId:string;name:string;role:string}>;relationshipBlocked?:boolean;actorHasBlocked?:boolean}

export default function ConversationScreen(){
  const {id}=useLocalSearchParams<{id:string}>();const {token,session}=useSession();const qc=useQueryClient();const scroll=useRef<ScrollView>(null);const [body,setBody]=useState('');const [error,setError]=useState<string|null>(null)
  const conversations=useQuery({queryKey:['communications-conversations',session?.user.accessUserId],enabled:Boolean(token),queryFn:()=>wewedRequest<{data:Conversation[]}>('/api/communications/conversations',{token})})
  const messages=useQuery({queryKey:['communications-messages',id],enabled:Boolean(token&&id),queryFn:()=>wewedRequest<{data:Message[]}>(`/api/communications/conversations/${id}/messages`,{token}),refetchInterval:15_000})
  const current=conversations.data?.data.find(item=>item.id===id)
  const title=useMemo(()=>current?.title?.trim()||current?.participants?.filter(p=>p.userId!==session?.user.accessUserId).map(p=>p.name).join(', ')||'Conversation',[current,session?.user.accessUserId])
  useEffect(()=>{if(!token||!id)return;void wewedRequest(`/api/communications/conversations/${id}/read`,{token,method:'POST'}).then(()=>qc.invalidateQueries({queryKey:['communications-conversations',session?.user.accessUserId]})).catch(()=>undefined)},[id,qc,session?.user.accessUserId,token,messages.dataUpdatedAt])
  useEffect(()=>{if(messages.data?.data.length)setTimeout(()=>scroll.current?.scrollToEnd({animated:false}),50)},[messages.data?.data.length])
  const send=useMutation({mutationFn:()=>wewedRequest(`/api/communications/conversations/${id}/messages`,{token,method:'POST',body:JSON.stringify({body:body.trim()})}),onSuccess:async()=>{setBody('');setError(null);await qc.invalidateQueries({queryKey:['communications-messages',id]});await qc.invalidateQueries({queryKey:['communications-conversations',session?.user.accessUserId]})},onError:(cause)=>setError(cause instanceof WewedApiError?cause.message:'Message could not be sent.')})
  const blocked=current?.relationshipBlocked||current?.actorHasBlocked
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={90}>
    <Stack.Screen options={{title}}/>
    <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
      {messages.isLoading?<Body muted>Loading conversation…</Body>:null}
      {(messages.data?.data??[]).map(message=>{const mine=message.senderUserId===session?.user.accessUserId;return <View key={message.id} style={[styles.bubbleWrap,mine?styles.mineWrap:styles.theirWrap]}><View style={[styles.bubble,mine?styles.mine:styles.theirs]}>{!mine&&message.senderName?<Text style={styles.sender}>{message.senderName}</Text>:null}<Text style={[styles.messageText,mine&&styles.mineText]}>{message.body}</Text><Text style={[styles.time,mine&&styles.mineTime]}>{new Date(message.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{message.editedAt?' · edited':''}</Text></View></View>})}
    </ScrollView>
    <View style={styles.composer}>{blocked?<View style={styles.blocked}><Text style={styles.blockedText}>Messaging is unavailable for this relationship.</Text></View>:<><View style={styles.inputWrap}><TextInput accessibilityLabel="Message" multiline value={body} onChangeText={setBody} placeholder="Message…" placeholderTextColor="#948C83" style={styles.input}/></View>{error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}<ActionButton label="Send" loading={send.isPending} disabled={!body.trim()} onPress={async()=>send.mutate()}/></>}</View>
  </KeyboardAvoidingView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.champagne},flex:{flex:1},messages:{padding:spacing.md,gap:spacing.sm,paddingBottom:spacing.lg},bubbleWrap:{flexDirection:'row'},mineWrap:{justifyContent:'flex-end'},theirWrap:{justifyContent:'flex-start'},bubble:{maxWidth:'83%',borderRadius:radius.lg,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,gap:4},mine:{backgroundColor:colors.espresso,borderBottomRightRadius:6},theirs:{backgroundColor:colors.white,borderColor:colors.border,borderWidth:StyleSheet.hairlineWidth,borderBottomLeftRadius:6},sender:{color:colors.goldMuted,fontSize:11,fontWeight:'800'},messageText:{color:colors.espresso,fontSize:15,lineHeight:21},mineText:{color:colors.champagne},time:{color:colors.inkMuted,fontSize:10,alignSelf:'flex-end'},mineTime:{color:'#C6BBAF'},composer:{padding:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,backgroundColor:colors.white,gap:spacing.xs},inputWrap:{borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.ivory,minHeight:52,maxHeight:130},input:{color:colors.espresso,fontSize:16,lineHeight:21,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},error:{color:colors.danger,fontSize:12},blocked:{padding:spacing.md,borderRadius:radius.md,backgroundColor:'#FFF2EF'},blockedText:{color:colors.danger,fontSize:13,fontWeight:'700'}})
