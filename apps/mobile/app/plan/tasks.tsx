import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import type { PlannerTask } from '@/lib/types'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

const priorities = ['all', 'high', 'medium', 'low'] as const
const statuses = ['todo', 'in_progress', 'blocked', 'done'] as const

export default function TasksScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const weddingId = session?.activeWedding?.id
  const key = ['planner-tasks', weddingId]
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [filter, setFilter] = useState<(typeof priorities)[number]>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const tasks = useQuery({
    queryKey: key,
    enabled: Boolean(token && weddingId),
    queryFn: () => wewedRequest<{ data: PlannerTask[] }>('/api/planner/tasks', { token }),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const createTask = useMutation({
    mutationFn: () => wewedRequest('/api/planner/tasks', {
      token,
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        category: 'other',
        priority,
        dueDate: dueDate.trim() || null,
        assignee: assignee.trim() || null,
        status: 'todo',
      }),
    }),
    onSuccess: async () => {
      setTitle(''); setAssignee(''); setDueDate(''); setPriority('medium'); setError(null)
      await refresh()
    },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Task could not be saved.'),
  })

  const patchTask = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => wewedRequest(`/api/planner/tasks/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    onSuccess: refresh,
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => wewedRequest(`/api/planner/tasks/${id}`, { token, method: 'DELETE' }),
    onSuccess: refresh,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tasks.data?.data ?? []).filter((task) => {
      if (filter !== 'all' && task.priority !== filter) return false
      if (!q) return true
      return [task.title, task.assignee ?? '', task.description ?? ''].some((value) => value.toLowerCase().includes(q))
    })
  }, [filter, search, tasks.data?.data])

  const complete = (tasks.data?.data ?? []).filter((task) => task.status === 'done').length
  const total = tasks.data?.data.length ?? 0

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Plan · Tasks</Eyebrow>
        <Title>What happens next?</Title>
        <Body muted>{total ? `${complete} of ${total} complete` : 'Create the first real action for this wedding.'}</Body>
      </View>

      <Surface>
        <Text style={styles.sectionTitle}>Quick capture</Text>
        <Body muted>Add the thought while it is fresh. You can refine ownership and timing immediately.</Body>
        <Field label="Task" value={title} onChangeText={setTitle} placeholder="Confirm florist arrival time" returnKeyType="next" />
        <Field label="Assignee" value={assignee} onChangeText={setAssignee} placeholder="Couple, auntie, coordinator…" />
        <Field label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chips}>
          {(['high', 'medium', 'low'] as const).map((value) => <ChoiceChip key={value} label={capitalize(value)} active={priority === value} onPress={() => setPriority(value)} />)}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ActionButton label="Add task" loading={createTask.isPending} onPress={async () => {
          if (!title.trim()) { setError('Task needs a title.'); return }
          createTask.mutate()
        }} />
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Checklist</Text>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Task or assignee" />
        <View style={styles.chips}>
          {priorities.map((value) => <ChoiceChip key={value} label={value === 'all' ? 'Any priority' : capitalize(value)} active={filter === value} onPress={() => setFilter(value)} />)}
        </View>
        {tasks.isLoading ? <Body muted>Loading your checklist…</Body> : null}
        {tasks.error ? <Body muted>Tasks could not be refreshed. Pull back and retry.</Body> : null}
        {!tasks.isLoading && filtered.length === 0 ? <Body muted>No tasks match this view.</Body> : null}
        {filtered.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            pending={patchTask.isPending || deleteTask.isPending}
            onStatus={(status) => patchTask.mutate({ id: task.id, body: { status } })}
            onDelete={() => Alert.alert('Delete task?', task.title, [
              { text: 'Keep', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteTask.mutate(task.id) },
            ])}
          />
        ))}
      </Surface>
    </Screen>
  )
}

function TaskCard({ task, pending, onStatus, onDelete }: { task: PlannerTask; pending: boolean; onStatus: (status: string) => void; onDelete: () => void }) {
  const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : task.status === 'blocked' ? 'in_progress' : 'todo'
  const nextLabel = task.status === 'done' ? 'Reopen' : task.status === 'in_progress' ? 'Complete' : task.status === 'blocked' ? 'Resume' : 'Start'
  return (
    <View style={[styles.task, task.status === 'done' && styles.taskDone]}>
      <View style={styles.taskTop}>
        <View style={styles.flexOne}>
          <Text style={[styles.taskTitle, task.status === 'done' && styles.strike]}>{task.title}</Text>
          <Text style={styles.taskMeta}>{task.assignee || 'Unassigned'}{task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString()}` : ''}</Text>
        </View>
        <Pill tone={task.priority === 'high' ? 'clay' : task.priority === 'low' ? 'sage' : 'gold'}>{capitalize(task.priority)}</Pill>
      </View>
      <View style={styles.taskActions}>
        <ActionButton label={nextLabel} disabled={pending} variant="secondary" onPress={() => onStatus(nextStatus)} />
        {task.status !== 'done' ? <ChoiceChip label="Blocked" active={task.status === 'blocked'} onPress={() => onStatus('blocked')} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.title}`} onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
      </View>
    </View>
  )
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function capitalize(value: string) { return value.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  label: { color: colors.espresso, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: minimumTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  chipText: { color: colors.inkMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.goldLight },
  task: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  taskDone: { opacity: 0.7 },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  taskTitle: { color: colors.espresso, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  strike: { textDecorationLine: 'line-through' },
  taskMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  taskActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  deleteButton: { minHeight: minimumTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13 },
  pressed: { opacity: 0.62 },
  flexOne: { flex: 1 },
})
