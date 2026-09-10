import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Divider, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type BookingDetail = {
  id: string
  publicReference?: string | null
  status: string
  bookingMode?: string | null
  currency?: string | null
  totalCents?: number | null
  depositCents?: number | null
  eventDate?: string | null
  serviceStart?: string | null
  serviceEnd?: string | null
  appointmentAt?: string | null
  pickupAt?: string | null
  returnDueAt?: string | null
  deliveryAt?: string | null
  setupStart?: string | null
  setupEnd?: string | null
  collectionAt?: string | null
  serviceLocation?: string | null
  providerName?: string | null
  itemName?: string | null
  notes?: string | null
  confirmedAt?: string | null
  serviceEngagementId?: string | null
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return 'Pending / quote required'
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) }
  catch { return `${currency} ${Math.round(cents / 100).toLocaleString()}` }
}

function timestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'Not set'
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['booking', id, session?.activeWedding?.id],
    enabled: Boolean(id && token),
    queryFn: () => wewedRequest<{ data: BookingDetail }>(`/api/bookings/${id}`, { token }),
  })
  const booking = query.data?.data

  const submit = useMutation({
    mutationFn: () => wewedRequest<{ data: BookingDetail }>(`/api/bookings/${id}/submit`, { token, method: 'POST' }),
    onSuccess: async () => {
      setError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['booking', id] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      ])
    },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Booking could not be submitted.'),
  })

  if (query.isLoading) return <Screen><Body muted>Loading booking…</Body></Screen>
  if (!booking) return <Screen><Stack.Screen options={{ title: 'Booking' }} /><Title>Booking unavailable</Title><Body muted>This booking is not available in the active wedding workspace.</Body></Screen>

  const title = booking.itemName || booking.providerName || booking.publicReference || 'Wewed booking'
  const draft = booking.status === 'draft'

  return (
    <Screen>
      <Stack.Screen options={{ title: booking.publicReference || 'Booking' }} />
      <View style={styles.heading}>
        <Eyebrow>Wewed governed booking</Eyebrow>
        <Title>{title}</Title>
        <View style={styles.inline}><Pill tone={draft ? 'gold' : booking.status === 'confirmed' ? 'sage' : 'plum'}>{pretty(booking.status)}</Pill>{booking.bookingMode ? <Pill>{pretty(booking.bookingMode)}</Pill> : null}</View>
      </View>

      <Surface>
        <Text style={styles.sectionTitle}>Commercial summary</Text>
        <Fact label="Reference" value={booking.publicReference || booking.id} />
        <Fact label="Total" value={money(booking.totalCents, booking.currency || 'USD')} />
        <Fact label="Deposit" value={booking.depositCents == null ? 'No deposit recorded yet' : money(booking.depositCents, booking.currency || 'USD')} />
        <Fact label="Status" value={pretty(booking.status)} />
        <Fact label="Service engagement" value={booking.serviceEngagementId ? 'Linked to governed service engagement' : 'Not yet linked'} />
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Wedding & service logistics</Text>
        <Fact label="Wedding / event date" value={timestamp(booking.eventDate)} />
        <Fact label="Service starts" value={timestamp(booking.serviceStart)} />
        <Fact label="Service ends" value={timestamp(booking.serviceEnd)} />
        <Fact label="Appointment" value={timestamp(booking.appointmentAt)} />
        <Fact label="Pickup" value={timestamp(booking.pickupAt)} />
        <Fact label="Return due" value={timestamp(booking.returnDueAt)} />
        <Fact label="Delivery" value={timestamp(booking.deliveryAt)} />
        <Fact label="Setup window" value={booking.setupStart || booking.setupEnd ? `${timestamp(booking.setupStart)} → ${timestamp(booking.setupEnd)}` : 'Not set'} />
        <Fact label="Collection" value={timestamp(booking.collectionAt)} />
        <Fact label="Location" value={booking.serviceLocation || 'Not set'} />
        {booking.notes ? <><Divider /><Body>{booking.notes}</Body></> : null}
      </Surface>

      {draft ? (
        <Surface>
          <Text style={styles.sectionTitle}>Submit this draft</Text>
          <Body muted>Submitting does not let the mobile app decide the result. The server applies Wewed booking governance and advances the draft according to its booking mode, availability, terms and commercial requirements.</Body>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton label="Submit governed booking draft" loading={submit.isPending} onPress={async () => { await submit.mutateAsync() }} />
        </Surface>
      ) : (
        <Surface>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <Body muted>Wewed will surface terms, quote, deposit, vendor action, fulfilment or return steps according to this booking's server-controlled state. Mobile will not label a booking confirmed until the canonical booking record says it is confirmed.</Body>
        </Surface>
      )}
    </Screen>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  fact: { gap: 2 },
  factLabel: { color: colors.goldMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  factValue: { color: colors.espresso, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
})
