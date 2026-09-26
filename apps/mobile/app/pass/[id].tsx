import React from 'react'
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { wewedRequest } from '@/lib/api'
import { colors, minimumTouchTarget, radius, shadow, spacing } from '@/theme/tokens'
import type { PassModel } from '@/lib/pass/pass-types'

export default function GuestPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const query = useQuery({
    queryKey: ['wedding-pass', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await wewedRequest<{ success: boolean; data: PassModel }>(`/api/pass/${id}`)
      return res.data
    },
  })

  const pass = query.data

  const openAppleWallet = async () => {
    if (!pass) return
    try {
      await WebBrowser.openBrowserAsync(pass.deepLinks.applePassUrl)
    } catch {
      Alert.alert('Download Error', 'Could not open Apple Wallet pass.')
    }
  }

  const openGoogleWallet = async () => {
    if (!pass) return
    try {
      await WebBrowser.openBrowserAsync(pass.deepLinks.googleWalletUrl)
    } catch {
      Alert.alert('Google Wallet Error', 'Could not open Google Wallet link.')
    }
  }

  const openDirections = async () => {
    if (!pass) return
    const query = encodeURIComponent(`${pass.wedding.venue}, ${pass.wedding.venueCity}`)
    const url = `https://maps.apple.com/?q=${query}`
    const can = await Linking.canOpenURL(url).catch(() => false)
    if (can) {
      await Linking.openURL(url)
    } else {
      await Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => undefined)
    }
  }

  if (query.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Title>Loading Wedding Pass…</Title>
          <Body muted>Preparing secure guest credential</Body>
        </View>
      </Screen>
    )
  }

  if (!pass) {
    return (
      <Screen>
        <View style={styles.center}>
          <Title>Pass Not Found</Title>
          <Body muted>The requested wedding pass could not be retrieved.</Body>
        </View>
      </Screen>
    )
  }

  const getStageDisplay = (stage: string) => {
    switch (stage) {
      case 'invitation':
        return { label: "YOU'RE INVITED", tone: 'gold' as const }
      case 'attending':
        return { label: 'ATTENDING ✓', tone: 'sage' as const }
      case 'pre_wedding':
        return { label: '7 DAYS TO GO', tone: 'clay' as const }
      case 'wedding_morning':
        return { label: 'TODAY • WEDDING DAY ❤️', tone: 'plum' as const }
      case 'checked_in':
        return { label: 'CHECKED IN ✓', tone: 'sage' as const }
      case 'during':
        return { label: 'HAPPENING NOW', tone: 'plum' as const }
      case 'after':
        return { label: 'THANK YOU ❤️', tone: 'gold' as const }
      default:
        return { label: 'WEDDING PASS', tone: 'gold' as const }
    }
  }

  const stage = getStageDisplay(pass.lifecycleStage)

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Wewed Wedding Pass</Eyebrow>
        <Title>{pass.wedding.coupleNames}</Title>
        <Body muted>{new Date(pass.wedding.date).toLocaleDateString()}</Body>
      </View>

      {/* Main Wallet Card Aesthetic */}
      <Surface style={styles.passCard}>
        <View style={styles.cardGoldTrim} />

        <View style={styles.cardHeader}>
          <Pill tone={stage.tone}>{stage.label}</Pill>
          <Text style={styles.cardBrand}>WEWED</Text>
        </View>

        {/* Couple & Date */}
        <View style={styles.coupleSection}>
          <Text style={styles.invitationSub}>Wedding of</Text>
          <Text style={styles.coupleTitle}>{pass.wedding.coupleNames}</Text>
          <Text style={styles.weddingVenue}>
            {pass.wedding.venue} • {pass.wedding.venueCity}
          </Text>
        </View>

        {/* Guest and Party Details */}
        <View style={styles.guestSection}>
          <View style={styles.detailBlock}>
            <Text style={styles.metaLabel}>Guest / Household</Text>
            <Text style={styles.guestName}>{pass.guest.guestName}</Text>
            {pass.guest.plusOneName && (
              <Text style={styles.plusOneName}>& {pass.guest.plusOneName}</Text>
            )}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.metaLabel}>Party Size</Text>
            <Text style={styles.partyCount}>
              {pass.guest.partyCount} {pass.guest.partyCount > 1 ? 'Guests' : 'Guest'}
            </Text>
          </View>
        </View>

        {/* Seating Assignment */}
        {pass.guest.tableName && (
          <View style={styles.seatingBanner}>
            <Text style={styles.seatingLabel}>Assigned Table</Text>
            <Text style={styles.seatingValue}>{pass.guest.tableName}</Text>
          </View>
        )}

        {/* Fast Action Buttons */}
        <View style={styles.walletActions}>
          <ActionButton label="Add to Apple Wallet" onPress={openAppleWallet} />
          <ActionButton
            label="Save to Google Wallet"
            variant="secondary"
            onPress={openGoogleWallet}
          />
          <ActionButton
            label="Directions to Venue"
            variant="quiet"
            onPress={openDirections}
          />
        </View>
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  passCard: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.champagne,
  },
  cardGoldTrim: {
    height: 6,
    backgroundColor: colors.gold,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardBrand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.inkMuted,
  },
  coupleSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xxs,
  },
  invitationSub: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.goldMuted,
    fontWeight: '600',
  },
  coupleTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.espresso,
    textAlign: 'center',
  },
  weddingVenue: {
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  guestSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  detailBlock: {
    flex: 1,
    gap: 2,
  },
  partyBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.espresso,
  },
  plusOneName: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  partyCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.espresso,
  },
  seatingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.ivory,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  seatingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  seatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso,
  },
  walletActions: {
    padding: spacing.md,
    gap: spacing.xs,
  },
})
