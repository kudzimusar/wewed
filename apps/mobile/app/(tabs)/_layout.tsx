import { Redirect, Tabs } from 'expo-router'
import React from 'react'
import { useSession } from '@/auth/session'
import { colors } from '@/theme/tokens'

export default function TabsLayout() {
  const { session, loading } = useSession()
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.champagne },
        headerTintColor: colors.espresso,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.espresso,
          borderTopColor: '#3A3430',
          minHeight: 66,
          paddingTop: 7,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.goldLight,
        tabBarInactiveTintColor: '#B8ADA2',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarAccessibilityLabel: 'Today tab',
          tabBarButtonTestID: 'native-tab-today',
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          headerShown: false,
          tabBarAccessibilityLabel: 'Plan tab',
          tabBarButtonTestID: 'native-tab-plan',
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          headerShown: false,
          tabBarAccessibilityLabel: 'Messages tab',
          tabBarButtonTestID: 'native-tab-messages',
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Vendors',
          headerShown: false,
          tabBarAccessibilityLabel: 'Vendors tab',
          tabBarButtonTestID: 'native-tab-vendors',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerShown: false,
          tabBarAccessibilityLabel: 'More tab',
          tabBarButtonTestID: 'native-tab-more',
        }}
      />
    </Tabs>
  )
}
