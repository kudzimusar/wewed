import { useQuery } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { wewedRequest } from '@/lib/api'
import { colors, radius, spacing } from '@/theme/tokens'

type Booking = {
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
  serviceLocation?: string | null
  providerName?: string | null
  itemName?: string | null
  catalogItemName?: string | null
  createdAt?: string | null
}

function tone(status: string): 'gold' | 'sage' | 'clay' | 'plum' {
  if (['confirmed', 'completed', 'ready'].includes(status)) return 'sage'
  if (['declined', 'cancelled', 'expired', 'disputed'].includes(status)) return 'clay'
  if (['awaiting_terms', 'awaiting_deposit', 'quote_proposed', 'return_due'].includes(status)) return 'plum'
  return 'gold'
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return 'Price pending'
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) }
  catch { return `${currency} ${Math.round(cents / 100).toLocaleString()}` }
}

export default function BookingsScreen() {
  const { token, session } = useSession()
  const query = useQuery({
    queryKey: ['bookings', session?.activeWedding?.id],
    enabled: Boolean(token && session?.activeWedding),
    queryFn: () => wewedRequest<{ data: Booking[] }>('/api/bookings', { token }),
  })
  const bookings = query.data?.data ?? []

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bookings' }} />
      <View style={styles.heading}>
        <Eyebrow>Governed commerce</Eyebrow>
        <Title>Bookings</Title>
        <Body muted>Track real Wewed booking states. An enquiry is not a booking, and a draft is not confirmed until the server advances it through the governed booking workflow.</Body>
      </View>

      {!session?.activeWedding ? <Surface><Body muted>Select an active wedding before viewing bookings.</Body></Surface> : null}
      {query.isLoading ? <Surface><Body muted>Loading bookings…</Body></Surface> : null}
      {query.isError ? <Surface><Body muted>Bookings could not be loaded.</Body><ActionButton label="Retry" variant="secondary" onPress={async () => { await query.refetch() }} /></Surface> : null}
      {!query.isLoading && !query.isError && session?.activeWedding && bookings.length === 0 ? (
        <Surface>
          <Text style={styles.sectionTitle}>No governed bookings yet</Text>
          <Body muted>Use the Vendor marketplace to discover providers and start secure enquiries. Wewed will only show booking actions for services backed by an actual published booking catalogue item.</Body>
          <ActionButton label="Browse vendor marketplace" onPress={() => router.push('/(tabs)/marketplace')} />
        </Surface>
      ) : null}

      {bookings.map((booking) => {
        const date = booking.eventDate || booking.serviceStart || booking.appointmentAt || booking.pickupAt
        const name = booking.itemName || booking.catalogItemName || booking.providerName || booking.publicReference || 'Wewed booking'
        return (
          <Pressable
            key={booking.id}
            accessibilityRole="button"
            accessibilityLabel={`Open booking ${booking.publicReference || name}`}
            onPress={() => router.push(`/bookings/${booking.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.name}>{name}</Text>
                {booking.publicReference ? <Text style={styles.reference}>{booking.publicReference}</Text> : null}
              </View>
              <Pill tone={tone(booking.status)}>{pretty(booking.status)}</Pill>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{booking.bookingMode ? pretty(booking.bookingMode) : 'Booking'}</Text>
              <Text style={styles.meta}>{money(booking.totalCents, booking.currency || 'USD')}</Text>
            </View>
            {date ? <Text style={styles.meta}>{new Date(date).toLocaleString()}</Text> : null}
            {booking.serviceLocation ? <Text style={styles.location}>{booking.serviceLocation}</Text> : null}
          </Pressable>
        )
      })}
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  pressed: { opacity: 0.76 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flexOne: { flex: 1 },
  name: { color: colors.espresso, fontSize: 17, fontWeight: '800' },
  reference: { color: colors.goldMuted, fontSize: 11, fontWeight: '800', marginTop: 3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  location: { color: colors.espresso, fontSize: 13, lineHeight: 19 },
})
