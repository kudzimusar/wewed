import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import React from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { wewedRequest } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type VendorBooking = {
  id: string
  publicReference?: string | null
  status?: string | null
  bookingMode?: string | null
  currency?: string | null
  totalCents?: number | null
  eventDate?: string | null
  serviceStart?: string | null
  customerName?: string | null
  weddingTitle?: string | null
  itemName?: string | null
}

type VendorDocument = {
  id: string
  linkRole: string
  displayName: string
  mimeType: string
  createdAt: string
  serviceEngagement: { id: string; serviceCategory: string; serviceDescription: string | null; lifecycleStatus: string } | null
  wedding: { id: string; title: string; date: string } | null
}

type CatalogItem = {
  id: string
  name: string
  status: string
  bookingMode: string
  bookingArchetype: string
  currency: string
  basePriceCents: number | null
  category: string
  offeringName: string
  variants?: unknown[]
  resources?: unknown[]
}

type CatalogPayload = {
  business: { businessAccountId: string; providerName?: string; displayName?: string }
  offerings: Array<{ id: string; category: string; displayName: string; status: string }>
  items: CatalogItem[]
}

function pretty(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Unknown'
}

function money(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return 'Quote / price not set'
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) }
  catch { return `${currency} ${Math.round(cents / 100).toLocaleString()}` }
}

export default function VendorHubScreen() {
  const { session, token } = useSession()
  const vendor = session?.user.role === 'vendor'
  const bookings = useQuery({ queryKey: ['vendor-bookings'], enabled: Boolean(token && vendor), queryFn: () => wewedRequest<{ data: VendorBooking[] }>('/api/vendor/bookings', { token }) })
  const documents = useQuery({ queryKey: ['vendor-documents'], enabled: Boolean(token && vendor), queryFn: () => wewedRequest<{ data: VendorDocument[] }>('/api/vendor/documents', { token }) })
  const catalog = useQuery({ queryKey: ['vendor-catalog'], enabled: Boolean(token && vendor), queryFn: () => wewedRequest<{ data: CatalogPayload }>('/api/vendor/catalog', { token }) })

  if (!vendor) return <Screen><Stack.Screen options={{ title: 'Vendor Hub' }} /><Title>Vendor access required</Title><Body muted>This workspace is only available to authenticated Wewed Vendor accounts.</Body></Screen>

  const bookingRows = bookings.data?.data ?? []
  const documentRows = documents.data?.data ?? []
  const catalogRows = catalog.data?.data.items ?? []
  const actionableBookings = bookingRows.filter((item) => item.status && !['completed','cancelled','declined','expired','refunded'].includes(item.status)).length
  const publishedItems = catalogRows.filter((item) => item.status === 'published').length

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Vendor Hub' }} />
      <View style={styles.heading}>
        <Eyebrow>Vendor business</Eyebrow>
        <Title>Vendor Hub</Title>
        <Body muted>Bookings, commercial documents and catalogue readiness from the same governed Wewed business account you use on the web.</Body>
      </View>

      <View style={styles.metrics}>
        <Metric label="Active bookings" value={String(actionableBookings)} tone="gold" />
        <Metric label="Published items" value={String(publishedItems)} tone="sage" />
        <Metric label="Documents" value={String(documentRows.length)} tone="plum" />
      </View>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Bookings</Text><Pill tone="gold">{bookingRows.length} total</Pill></View>
        {bookings.isLoading ? <Body muted>Loading vendor bookings…</Body> : null}
        {!bookings.isLoading && bookingRows.length === 0 ? <Body muted>No governed bookings are currently assigned to this Vendor account.</Body> : null}
        {bookingRows.slice(0, 8).map((booking) => <View key={booking.id} style={styles.item}><View style={styles.flexOne}><Text style={styles.itemTitle}>{booking.itemName || booking.weddingTitle || booking.publicReference || 'Wewed booking'}</Text><Text style={styles.meta}>{booking.publicReference || booking.id} · {pretty(booking.bookingMode)}</Text>{booking.eventDate || booking.serviceStart ? <Text style={styles.meta}>{new Date(booking.eventDate || booking.serviceStart || '').toLocaleString()}</Text> : null}</View><View style={styles.right}><Pill tone={booking.status === 'confirmed' ? 'sage' : 'gold'}>{pretty(booking.status)}</Pill><Text style={styles.price}>{money(booking.totalCents, booking.currency || 'USD')}</Text></View></View>)}
      </Surface>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Catalogue</Text><Pill tone="sage">{publishedItems} live</Pill></View>
        <Body muted>Instant Book and advanced package items remain fail-closed until their required resources, availability or components are configured by the governed catalogue backend.</Body>
        {catalog.isLoading ? <Body muted>Loading catalogue…</Body> : null}
        {catalogRows.slice(0, 10).map((item) => <View key={item.id} style={styles.item}><View style={styles.flexOne}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.meta}>{pretty(item.category)} · {pretty(item.bookingArchetype)} · {pretty(item.bookingMode)}</Text></View><View style={styles.right}><Pill tone={item.status === 'published' ? 'sage' : 'clay'}>{pretty(item.status)}</Pill><Text style={styles.price}>{money(item.basePriceCents,item.currency)}</Text></View></View>)}
      </Surface>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Commercial documents</Text><Pill tone="plum">Secure</Pill></View>
        <Body muted>Only distributable Service Engagement documents authorized for this active Vendor identity appear here.</Body>
        {documents.isLoading ? <Body muted>Loading documents…</Body> : null}
        {documentRows.slice(0, 10).map((document) => <View key={document.id} style={styles.item}><View style={styles.flexOne}><Text style={styles.itemTitle}>{document.displayName}</Text><Text style={styles.meta}>{document.wedding?.title || 'Service engagement'} · {pretty(document.linkRole)}</Text><Text style={styles.meta}>{document.serviceEngagement ? `${pretty(document.serviceEngagement.serviceCategory)} · ${pretty(document.serviceEngagement.lifecycleStatus)}` : document.mimeType}</Text></View></View>)}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Full business controls</Text>
        <Body muted>Complex catalogue configuration, availability rules, resources and document operations stay on the full Vendor workspace until every dense workflow has a purpose-built native equivalent.</Body>
        <ActionButton label="Open full Vendor workspace" variant="secondary" onPress={async () => { await Linking.openURL('https://wewed.pro/vendor') }} />
      </Surface>
    </Screen>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'sage' | 'plum' }) {
  return <View style={styles.metric}><Pill tone={tone}>{label}</Pill><Text style={styles.metricValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  heading:{gap:spacing.xs},metrics:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},metric:{minWidth:'30%',flex:1,backgroundColor:colors.white,borderColor:colors.border,borderWidth:1,padding:spacing.sm,gap:spacing.xs},metricValue:{color:colors.espresso,fontFamily:'serif',fontSize:30,fontWeight:'600'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:spacing.sm},sectionTitle:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},item:{flexDirection:'row',gap:spacing.sm,paddingTop:spacing.sm,borderTopColor:colors.border,borderTopWidth:StyleSheet.hairlineWidth},itemTitle:{color:colors.espresso,fontSize:14,fontWeight:'800'},meta:{color:colors.inkMuted,fontSize:11,lineHeight:17,marginTop:2},price:{color:colors.goldMuted,fontSize:11,fontWeight:'800',textAlign:'right'},right:{alignItems:'flex-end',gap:spacing.xs,maxWidth:'42%'},flexOne:{flex:1}
})
