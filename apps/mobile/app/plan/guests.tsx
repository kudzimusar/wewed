import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

type Guest = {
  id: string; name: string; email: string | null; phone: string | null; role: string; side: string | null
  seatingTableId: string | null; seatingTableName: string | null
  rsvp: { attending: boolean | null; plusOne: boolean; kidsCount: number; checkedIn: boolean } | null
}
type Table = { id: string; name: string; capacity: number; tableType?: string; zone?: string | null }

export default function GuestsScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const weddingId = session?.activeWedding?.id
  const key = ['planner-guests', weddingId]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [side, setSide] = useState<'bride' | 'groom' | 'family' | 'neutral'>('neutral')
  const [tableId, setTableId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showTableForm, setShowTableForm] = useState(false)
  const [tableName, setTableName] = useState('')
  const [capacity, setCapacity] = useState('8')

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(token && weddingId),
    queryFn: () => wewedRequest<{ data: Guest[]; tables: Table[] }>('/api/planner/guests', { token }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const addGuest = useMutation({
    mutationFn: () => wewedRequest('/api/planner/guests', { token, method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, role: 'guest', side, seatingTableId: tableId || undefined }) }),
    onSuccess: async () => { setName(''); setEmail(''); setPhone(''); setSide('neutral'); setTableId(''); setError(null); await refresh() },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Guest could not be saved.'),
  })
  const addTable = useMutation({
    mutationFn: () => wewedRequest('/api/planner/guests', { token, method: 'POST', body: JSON.stringify({ kind: 'table', tableName: tableName.trim(), capacity: Number(capacity) || 8 }) }),
    onSuccess: async () => { setTableName(''); setCapacity('8'); setShowTableForm(false); setError(null); await refresh() },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Table could not be saved.'),
  })
  const assign = useMutation({
    mutationFn: ({ guestId, seatingTableId }: { guestId: string; seatingTableId: string | null }) => wewedRequest(`/api/planner/guests/${guestId}`, { token, method: 'PATCH', body: JSON.stringify({ seatingTableId }) }),
    onSuccess: refresh,
    onError: (cause) => Alert.alert('Seating unchanged', cause instanceof WewedApiError ? cause.message : 'Wewed could not move this guest.'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => wewedRequest(`/api/planner/guests/${id}`, { token, method: 'DELETE' }),
    onSuccess: refresh,
  })

  const guests = query.data?.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return guests
    return guests.filter((guest) => [guest.name, guest.email ?? '', guest.phone ?? '', guest.seatingTableName ?? ''].some((value) => value.toLowerCase().includes(q)))
  }, [guests, search])
  const attending = guests.filter((guest) => guest.rsvp?.attending === true).length
  const pending = guests.filter((guest) => guest.rsvp?.attending == null).length

  return (
    <Screen>
      <View style={styles.header}><Eyebrow>Plan · Guests</Eyebrow><Title>People, not rows.</Title><Body muted>Keep invitations, RSVP state and seating context close enough to use while you are moving around an event.</Body></View>
      <View style={styles.metrics}><Metric label="Guests" value={guests.length} tone="gold" /><Metric label="Attending" value={attending} tone="sage" /><Metric label="Awaiting RSVP" value={pending} tone="clay" /></View>

      <Surface>
        <Text style={styles.sectionTitle}>Add guest</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Guest name" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Optional" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Optional" />
        <Text style={styles.label}>Side</Text><View style={styles.chips}>{(['bride','groom','family','neutral'] as const).map((value) => <Chip key={value} label={pretty(value)} active={side === value} onPress={() => setSide(value)} />)}</View>
        {query.data?.tables.length ? <><Text style={styles.label}>Seat now (optional)</Text><View style={styles.chips}><Chip label="Not seated" active={!tableId} onPress={() => setTableId('')} />{query.data.tables.map((table) => <Chip key={table.id} label={table.name} active={tableId === table.id} onPress={() => setTableId(table.id)} />)}</View></> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ActionButton label="Add guest" loading={addGuest.isPending} onPress={async () => { if (!name.trim()) { setError('Guest name is required.'); return } addGuest.mutate() }} />
      </Surface>

      <Surface>
        <View style={styles.titleRow}><View style={styles.flexOne}><Text style={styles.sectionTitle}>Seating tables</Text><Body muted>{query.data?.tables.length ?? 0} tables</Body></View><ActionButton label={showTableForm ? 'Close' : 'Add table'} variant="quiet" onPress={() => setShowTableForm((value) => !value)} /></View>
        {showTableForm ? <View style={styles.tableForm}><Field label="Table name" value={tableName} onChangeText={setTableName} placeholder="Family table A" /><Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /><ActionButton label="Create table" loading={addTable.isPending} onPress={async () => { if (!tableName.trim()) { setError('Table name is required.'); return } addTable.mutate() }} /></View> : null}
        {(query.data?.tables ?? []).map((table) => <View key={table.id} style={styles.tableRow}><Text style={styles.guestName}>{table.name}</Text><Pill tone="gold">{table.capacity} seats</Pill></View>)}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Guest list</Text><Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, email, phone or table" />
        {query.isLoading ? <Body muted>Loading guests…</Body> : null}
        {filtered.map((guest) => <View key={guest.id} style={styles.guestCard}>
          <View style={styles.titleRow}><View style={styles.flexOne}><Text style={styles.guestName}>{guest.name}</Text><Text style={styles.meta}>{guest.email || guest.phone || pretty(guest.side || 'neutral')}</Text></View><Pill tone={guest.rsvp?.attending === true ? 'sage' : guest.rsvp?.attending === false ? 'plum' : 'gold'}>{guest.rsvp?.attending === true ? 'Attending' : guest.rsvp?.attending === false ? 'Declined' : 'Awaiting RSVP'}</Pill></View>
          <Text style={styles.meta}>{guest.seatingTableName ? `Seated · ${guest.seatingTableName}` : 'Not seated'}</Text>
          {query.data?.tables.length ? <View style={styles.chips}><Chip label="Unseat" active={!guest.seatingTableId} onPress={() => assign.mutate({ guestId: guest.id, seatingTableId: null })} />{query.data.tables.slice(0, 6).map((table) => <Chip key={table.id} label={table.name} active={guest.seatingTableId === table.id} onPress={() => assign.mutate({ guestId: guest.id, seatingTableId: table.id })} />)}</View> : null}
          <Pressable accessibilityRole="button" onPress={() => Alert.alert('Remove guest?', guest.name, [{ text: 'Keep', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(guest.id) }])} style={styles.remove}><Text style={styles.removeText}>Remove guest</Text></Pressable>
        </View>)}
      </Surface>
    </Screen>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'gold'|'sage'|'clay' }) { const c = tone === 'sage' ? colors.sage : tone === 'clay' ? colors.clay : colors.gold; return <View style={styles.metric}><View style={[styles.metricLine,{backgroundColor:c}]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity:.6}]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable> }
function pretty(value: string) { return value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase()) }
const styles = StyleSheet.create({ header:{gap:spacing.xs}, metrics:{flexDirection:'row',gap:spacing.xs}, metric:{flex:1,minHeight:94,backgroundColor:colors.white,borderRadius:radius.lg,borderColor:colors.border,borderWidth:StyleSheet.hairlineWidth,padding:spacing.sm,overflow:'hidden'},metricLine:{position:'absolute',left:0,top:0,bottom:0,width:4},metricValue:{color:colors.espresso,fontFamily:'serif',fontSize:27,fontWeight:'600'},metricLabel:{color:colors.inkMuted,fontSize:11,fontWeight:'700',marginTop:4},sectionTitle:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},label:{color:colors.espresso,fontSize:13,fontWeight:'700'},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{minHeight:minimumTouchTarget,justifyContent:'center',paddingHorizontal:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.espresso,borderColor:colors.espresso},chipText:{color:colors.inkMuted,fontSize:12,fontWeight:'700'},chipTextActive:{color:colors.goldLight},titleRow:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},tableForm:{gap:spacing.sm,paddingTop:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},tableRow:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},guestCard:{gap:spacing.sm,paddingTop:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},guestName:{color:colors.espresso,fontSize:16,fontWeight:'700'},meta:{color:colors.inkMuted,fontSize:12,lineHeight:17,marginTop:2},remove:{minHeight:minimumTouchTarget,alignSelf:'flex-start',justifyContent:'center'},removeText:{color:colors.danger,fontSize:13,fontWeight:'800'},error:{color:colors.danger,fontSize:13},flexOne:{flex:1} })
