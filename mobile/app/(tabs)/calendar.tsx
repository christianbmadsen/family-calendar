import { useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/lib/auth'
import { eventsApi } from '@/lib/api'
import MonthView from '@/components/calendar/MonthView'
import DayView from '@/components/calendar/DayView'
import { colors, spacing, radius, text } from '@/lib/theme'
import type { CalendarEvent } from '@/lib/types'

type View = 'month' | 'day'

export default function CalendarScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('day')
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  const { data: events = [] } = useQuery({
    queryKey: ['events', monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: () => eventsApi.list(monthStart.toISOString(), monthEnd.toISOString()),
    enabled: !!user,
  })

  function handleDayPress(date: Date) {
    setCurrentDate(date)
    setView('day')
  }

  function handleEventPress(event: CalendarEvent) {
    router.push(`/events/${event.id}`)
  }

  async function handleSync() {
    await eventsApi.sync()
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  return (
    <View style={s.container}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.toggle}>
          {(['day', 'month'] as View[]).map(v => (
            <TouchableOpacity
              key={v}
              style={[s.toggleBtn, view === v && s.toggleActive]}
              onPress={() => setView(v)}
            >
              <Text style={[s.toggleText, view === v && s.toggleTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.actions}>
          <TouchableOpacity onPress={handleSync} style={s.iconBtn}>
            <Ionicons name="sync-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push('/events/new')}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.content}>
        {view === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            onNavigate={setCurrentDate}
            onDayPress={handleDayPress}
          />
        ) : (
          <DayView
            currentDate={currentDate}
            events={events}
            onNavigate={setCurrentDate}
            onEventPress={handleEventPress}
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: 2,
  },
  toggleBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm - 2 },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: text.sm, fontWeight: '500', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { padding: spacing.xs },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.xs + 2,
  },
  content: { flex: 1, padding: spacing.md },
})
