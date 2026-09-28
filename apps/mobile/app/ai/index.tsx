import { useMutation } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, radius, spacing } from '@/theme/tokens'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type AiSource = { citation: string; title: string; sourceUrl?: string | null; visibility?: string }
type AiReply = { reply: string; sources?: AiSource[]; area?: string; model?: string; provider?: string }

const STARTERS = [
  'What needs my attention next?',
  'What are the biggest risks in this wedding plan?',
  'Review overdue tasks and recommend the next three actions.',
  'What should we check before paying the next vendor?',
]

export default function AiScreen() {
  const { token, session } = useSession()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sources, setSources] = useState<AiSource[]>([])
  const [error, setError] = useState<string | null>(null)

  const canUsePlannerAi = Boolean(session?.activeWedding && session.user.role !== 'vendor')
  const requestMessages = useMemo(() => messages.slice(-8), [messages])

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const payloadMessages: ChatMessage[] = [...requestMessages, { role: 'user', content: question }]
      return wewedRequest<AiReply>('/api/ai/chat', {
        token,
        method: 'POST',
        body: JSON.stringify({
          context: 'couple',
          area: 'planner_copilot',
          messages: payloadMessages,
          useDocuments: true,
        }),
      })
    },
    onSuccess: (payload, question) => {
      setMessages((current) => [...current, { role: 'user', content: question }, { role: 'assistant', content: payload.reply }])
      setSources(payload.sources ?? [])
      setError(null)
      setInput('')
    },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Wewed AI is temporarily unavailable.'),
  })

  async function submit(question = input) {
    const clean = question.trim()
    if (!clean || ask.isPending || !canUsePlannerAi) return
    await ask.mutateAsync(clean).catch(() => undefined)
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Wewed AI' }} />
      <View style={styles.heading}>
        <Eyebrow>One Wewed AI Core</Eyebrow>
        <Title>Planner Copilot</Title>
        <Body muted>Ask Wewed AI about the active wedding using the same private planner context and retrieval controls as the web app. Advice is not an automatic change to your wedding records.</Body>
      </View>

      {!canUsePlannerAi ? (
        <Surface>
          <Text style={styles.sectionTitle}>Planner AI is not available in this workspace</Text>
          <Body muted>Select an active wedding with planner access. Vendor accounts use their governed vendor tools and Messages instead of private couple/planner AI context.</Body>
        </Surface>
      ) : null}

      {canUsePlannerAi && messages.length === 0 ? (
        <Surface>
          <Text style={styles.sectionTitle}>Start with your wedding</Text>
          <Body muted>Wewed AI can analyse authorised tasks, RSVPs, vendors, budget, payments, timeline, risks and cultural considerations. It must present proposed changes as recommendations for human confirmation.</Body>
          {STARTERS.map((starter) => <ActionButton key={starter} label={starter} variant="secondary" onPress={() => submit(starter)} />)}
        </Surface>
      ) : null}

      {messages.map((message, index) => (
        <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}>
          <View style={styles.inline}><Pill tone={message.role === 'user' ? 'gold' : 'sage'}>{message.role === 'user' ? 'You' : 'Wewed AI'}</Pill></View>
          <Text selectable style={styles.message}>{message.content}</Text>
        </View>
      ))}

      {sources.length > 0 ? (
        <Surface>
          <Text style={styles.sectionTitle}>Sources used</Text>
          {sources.map((source) => <View key={`${source.citation}-${source.title}`} style={styles.source}><Text style={styles.sourceCitation}>[{source.citation}]</Text><Text style={styles.sourceTitle}>{source.title}</Text></View>)}
        </Surface>
      ) : null}

      {canUsePlannerAi ? (
        <Surface>
          <Field label="Ask Wewed AI" value={input} onChangeText={setInput} multiline placeholder="Ask about priorities, budget risk, guests, vendors or wedding-week readiness…" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton label="Ask Planner Copilot" loading={ask.isPending} disabled={!input.trim()} onPress={() => submit()} />
          <Body muted>Wewed AI can recommend and draft. Record changes, messages, bookings, contracts and payments remain governed by their dedicated Wewed confirmation flows.</Body>
        </Surface>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  bubble: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1 },
  userBubble: { backgroundColor: '#F6EEDF', borderColor: '#E3D2AF', marginLeft: spacing.lg },
  aiBubble: { backgroundColor: colors.white, borderColor: colors.border, marginRight: spacing.lg },
  inline: { flexDirection: 'row' },
  message: { color: colors.espresso, fontSize: 14, lineHeight: 21 },
  source: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  sourceCitation: { color: colors.goldMuted, fontSize: 12, fontWeight: '900' },
  sourceTitle: { color: colors.espresso, fontSize: 12, lineHeight: 18, flex: 1 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
})
