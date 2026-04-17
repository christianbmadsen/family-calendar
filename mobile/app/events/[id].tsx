import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { eventsApi } from '@/lib/api'
import EventForm from '@/components/EventForm'
import { colors, spacing, radius, text } from '@/lib/theme'
import type { EventCreate } from '@/lib/types'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(id),
  })

  async function handleUpdate(data: EventCreate) {
    await eventsApi.update(id, data)
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    setEditing(false)
  }

  function handleDelete() {
    Alert.alert('Delete event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await eventsApi.delete(id)
          queryClient.invalidateQueries({ queryKey: ['events'] })
          router.back()
        },
      },
    ])
  }

  if (isLoading || !event) {
    return (
      <View style={s.center}>
        <Text style={s.loading}>{isLoading ? 'Loading…' : 'Event not found.'}</Text>
      </View>
    )
  }

  if (editing) {
    return <EventForm initial={event} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Save changes" />
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{event.title}</Text>

      <View style={s.timeBox}>
        <Text style={s.timeText}>
          {event.is_all_day
            ? `All day · ${event.start_datetime ? format(new Date(event.start_datetime), 'EEE, MMM d yyyy') : 'No date'}`
            : event.start_datetime
              ? `${format(new Date(event.start_datetime), 'EEE, MMM d yyyy · HH:mm')}${event.end_datetime ? ` – ${format(new Date(event.end_datetime), 'HH:mm')}` : ''}`
              : 'No date set'
          }
        </Text>
      </View>

      {event.location && (
        <View style={s.row}>
          <Text style={s.rowIcon}>📍</Text>
          <Text style={s.rowText}>{event.location}</Text>
        </View>
      )}

      {event.description && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Description</Text>
          <Text style={s.sectionText}>{event.description}</Text>
        </View>
      )}

      {event.references && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>References</Text>
          <Text style={s.sectionText}>{event.references}</Text>
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
          <Text style={s.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: text.sm, color: colors.textSecondary },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: text.xxl, fontWeight: '700', color: colors.text },
  timeBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeText: { fontSize: text.sm, color: colors.primary, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowIcon: { fontSize: text.base },
  rowText: { fontSize: text.sm, color: colors.textSecondary, flex: 1 },
  section: { gap: spacing.xs },
  sectionLabel: { fontSize: text.xs, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionText: { fontSize: text.sm, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editText: { fontSize: text.sm, fontWeight: '600', color: colors.text },
  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
  },
  deleteText: { fontSize: text.sm, fontWeight: '600', color: colors.danger },
})
