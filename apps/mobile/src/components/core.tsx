import * as Haptics from 'expo-haptics'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, minimumTouchTarget, radius, shadow, spacing } from '@/theme/tokens'

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const content = scroll
    ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screenContent}>{children}</ScrollView>
    : <View style={styles.screenContent}>{children}</View>
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>
}

export function Body({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>
}

export function Surface({ children, style }: ViewProps) {
  return <View style={[styles.surface, style]}>{children}</View>
}

interface ActionButtonProps {
  label: string
  onPress: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  accessibilityHint?: string
}

export function ActionButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityHint,
}: ActionButtonProps) {
  const press = async () => {
    await Haptics.selectionAsync().catch(() => undefined)
    await onPress()
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={() => void press()}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.espresso : colors.gold} /> : (
        <Text style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'danger' && styles.buttonTextDanger,
        ]}>{label}</Text>
      )}
    </Pressable>
  )
}

interface FieldProps extends TextInputProps {
  label: string
  error?: string | null
}

export function Field({ label, error, style, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor="#968F86"
        style={[styles.field, error ? styles.fieldError : null, style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  )
}

export function Pill({ children, tone = 'gold' }: { children: React.ReactNode; tone?: 'gold' | 'sage' | 'clay' | 'plum' }) {
  const background = tone === 'sage' ? '#EEEDE4' : tone === 'clay' ? '#F6E9E3' : tone === 'plum' ? '#F2E8EB' : '#F3EBDD'
  const foreground = tone === 'sage' ? colors.sage : tone === 'clay' ? colors.clay : tone === 'plum' ? colors.plum : colors.goldMuted
  return <View style={[styles.pill, { backgroundColor: background }]}><Text style={[styles.pillText, { color: foreground }]}>{children}</Text></View>
}

export function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.champagne },
  screenContent: { flexGrow: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md },
  eyebrow: { color: colors.goldMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.espresso, fontFamily: 'serif', fontSize: 34, lineHeight: 39, fontWeight: '500' },
  body: { color: colors.espresso, fontSize: 15, lineHeight: 22 },
  bodyMuted: { color: colors.inkMuted },
  surface: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  button: { minHeight: minimumTouchTarget, minWidth: minimumTouchTarget, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  buttonPrimary: { backgroundColor: colors.gold },
  buttonSecondary: { backgroundColor: colors.white, borderColor: colors.goldMuted },
  buttonQuiet: { backgroundColor: 'transparent', borderColor: colors.border },
  buttonDanger: { backgroundColor: '#FFF5F2', borderColor: '#E7BBB0' },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: colors.espresso, fontWeight: '700', fontSize: 15 },
  buttonTextPrimary: { color: colors.espresso },
  buttonTextDanger: { color: colors.danger },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { color: colors.espresso, fontSize: 13, fontWeight: '700' },
  field: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, color: colors.espresso, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16 },
  fieldError: { borderColor: colors.clay },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
})
