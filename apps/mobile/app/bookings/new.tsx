import { useMutation, useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, radius, spacing } from '@/theme/tokens'

type Variant = { id: string; name: string; priceOverrideCents: number | null; inventoryMode: string }
type BookableItem = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  bookingArchetype: string
  bookingMode: string
  basePriceCents: number | null
  currency: string
  pricingUnit: string | null
  minQuantity: number | null
  maxQuantity: number | null
  requiresFitting: boolean
  requiresContract: boolean
  variants: Variant[]
  resourceCount: number
}
type CatalogPayload = { provider: { slug: string; displayName: string }; items: BookableItem[] }

type BookingCreated = { id: string; status?: string; publicReference?: string }

function pretty(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function money(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return 'Quote required'
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) }
  catch { return `${currency} ${Math.round(cents / 100).toLocaleString()}` }
}

export default function NewBookingScreen() {
  const params = useLocalSearchParams<{ providerSlug?: string; itemId?: string }>()
  const { token, session } = useSession()
  const providerSlug = typeof params.providerSlug === 'string' ? params.providerSlug : ''
  const itemId = typeof params.itemId === 'string' ? params.itemId : ''
  const [variantId, setVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [eventDate, setEventDate] = useState(session?.activeWedding?.date?.slice(0, 10) ?? '')
  const [serviceLocation, setServiceLocation] = useState(session?.activeWedding?.venueCity ?? '')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const catalog = useQuery({
    queryKey: ['provider-catalog', providerSlug],
    enabled: Boolean(providerSlug),
    queryFn: () => wewedRequest<{ data: CatalogPayload }>(`/api/providers/${providerSlug}/catalog`),
  })
  const item = useMemo(() => catalog.data?.data.items.find((entry) => entry.id === itemId) ?? null, [catalog.data?.data.items, itemId])
  const selectedVariant = item?.variants.find((variant) => variant.id === variantId) ?? null
  const displayedPrice = selectedVariant?.priceOverrideCents ?? item?.basePriceCents ?? null
  const canBook = Boolean(token && session?.activeWedding && session.user.role !== 'vendor' && item)

  const create = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('Bookable item is unavailable.')
      return wewedRequest<{ data: BookingCreated }>('/api/bookings', {
        token,
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          variantId: selectedVariant?.id ?? null,
          quantity: Math.max(1, Number.parseInt(quantity || '1', 10) || 1),
          eventDate: eventDate || undefined,
          serviceLocation: serviceLocation.trim() || undefined,
          guestCount: guestCount ? Number.parseInt(guestCount, 10) : undefined,
          notes: notes.trim() || undefined,
        }),
      })
    },
    onSuccess: (payload) => {
      setError(null)
      router.replace(`/bookings/${payload.data.id}`)
    },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : cause instanceof Error ? cause.message : 'Booking draft could not be created.'),
  })

  if (catalog.isLoading) return <Screen><Stack.Screen options={{ title: 'Book service' }} /><Body muted>Loading bookable service…</Body></Screen>
  if (!item) return <Screen><Stack.Screen options={{ title: 'Book service' }} /><Title>Bookable service unavailable</Title><Body muted>This provider item is no longer published or could not be found.</Body></Screen>

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Create booking draft' }} />
      <View style={styles.heading}>
        <Eyebrow>{catalog.data?.data.provider.displayName || 'Wewed provider'} · {pretty(item.bookingMode)}</Eyebrow>
        <Title>{item.name}</Title>
        <Body muted>{item.description || 'Configure this published Wewed booking item for the active wedding.'}</Body>
      </View>

      <Surface>
        <View style={styles.row}><View style={styles.flexOne}><Text style={styles.sectionTitle}>Booking basis</Text><Body muted>{pretty(item.bookingArchetype)} · {pretty(item.category)}</Body></View><Pill tone={item.bookingMode === 'instant' ? 'sage' : item.bookingMode === 'quote' ? 'plum' : 'gold'}>{pretty(item.bookingMode)}</Pill></View>
        <Fact label="Price" value={money(displayedPrice, item.currency)} />
        <Fact label="Pricing unit" value={item.pricingUnit || 'Per booking / provider policy'} />
        <Fact label="Quantity range" value={`${item.minQuantity ?? 1} – ${item.maxQuantity ?? 'provider maximum'}`} />
        {item.requiresFitting ? <Pill tone="clay">Fitting required</Pill> : null}
        {item.requiresContract ? <Pill tone="plum">Contract required before confirmation</Pill> : null}
      </Surface>

      {item.variants.length > 0 ? (
        <Surface>
          <Text style={styles.sectionTitle}>Choose an option</Text>
          {item.variants.map((variant) => {
            const selected = variant.id === variantId
            return <Pressable key={variant.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setVariantId(selected ? null : variant.id)} style={[styles.option, selected && styles.optionSelected]}><View style={styles.flexOne}><Text style={styles.optionTitle}>{variant.name}</Text><Text style={styles.meta}>{pretty(variant.inventoryMode)}</Text></View><Text style={styles.optionPrice}>{money(variant.priceOverrideCents ?? item.basePriceCents, item.currency)}</Text></Pressable>
          })}
        </Surface>
      ) : null}

      <Surface>
        <Text style={styles.sectionTitle}>Wedding details</Text>
        <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Field label="Wedding / event date" value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD" />
        <Field label="Service location" value={serviceLocation} onChangeText={setServiceLocation} placeholder="Harare, venue or address" />
        <Field label="Guest count" value={guestCount} onChangeText={setGuestCount} keyboardType="number-pad" placeholder="Optional" />
        <Field label="Notes for this draft" value={notes} onChangeText={setNotes} multiline placeholder="Access, setup, timing or service notes…" />
      </Surface>

      {!canBook ? <Surface><Body muted>Select an active wedding with booking authority before creating a draft. Vendor accounts cannot create customer bookings from this screen.</Body></Surface> : (
        <Surface>
          <Text style={styles.sectionTitle}>Create draft first</Text>
          <Body muted>Wewed will validate quantity, variant, pricing and booking policy on the server. Creating this record produces a draft—not a confirmation. You can review it before the separate governed Submit action.</Body>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton label="Create governed booking draft" loading={create.isPending} onPress={async () => { await create.mutateAsync().catch(() => undefined) }} />
        </Surface>
      )}
    </Screen>
  )
}

function Fact({ label, value }: { label: string; value: string }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View> }

const styles = StyleSheet.create({
  heading:{gap:spacing.xs},row:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},flexOne:{flex:1},sectionTitle:{color:colors.espresso,fontFamily:'serif',fontSize:22,fontWeight:'600'},fact:{gap:2},factLabel:{color:colors.goldMuted,fontSize:11,fontWeight:'900',letterSpacing:1,textTransform:'uppercase'},factValue:{color:colors.espresso,fontSize:14,lineHeight:20},option:{flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.sm},optionSelected:{borderColor:colors.gold,backgroundColor:colors.ivory},optionTitle:{color:colors.espresso,fontSize:14,fontWeight:'800'},optionPrice:{color:colors.goldMuted,fontSize:12,fontWeight:'900'},meta:{color:colors.inkMuted,fontSize:11,marginTop:2},error:{color:colors.danger,fontSize:13,lineHeight:18}
})
