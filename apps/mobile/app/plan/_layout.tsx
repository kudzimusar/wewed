import { Stack } from 'expo-router'
import React from 'react'
import { colors } from '@/theme/tokens'

export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.champagne },
        headerTintColor: colors.espresso,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.champagne },
        headerBackTitle: 'Plan',
      }}
    >
      <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Stack.Screen name="budget" options={{ title: 'Budget' }} />
      <Stack.Screen name="guests" options={{ title: 'Guests & Seating' }} />
      <Stack.Screen name="vendors" options={{ title: 'Wedding Vendors' }} />
      <Stack.Screen name="contributions" options={{ title: 'Contributions' }} />
      <Stack.Screen name="timeline" options={{ title: 'Timeline' }} />
    </Stack>
  )
}
