import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { addDays, subDays, format, isSameDay, isToday } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'
import { colors, spacing, radius, text } from '@/lib/theme'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onNavigate: (date: Date) => void
  onEventPress: (event: CalendarEvent) => void
}

export default function DayView({ currentDate, events, onNavigate, onEventPress }: Props) {
  const dayEvents = events
    .filter(e => e.start_datetime && isSameDay(new Date(e.start_datetime), currentDate))
    .sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1
      if (!a.is_all_day && b.is_all_day) return 1
      return new Date(a.start_datetime!).getTime() - new Date(b.start_datetime!).getTime()
    })

  const today = isToday(currentDate)

  return (
    <View style={s.container}>
      {/* Date navigation */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => onNavigate(subDays(currentDate, 1))} style={s.navBtn}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.dateCenter}>
          <Text style={[s.dateNum, today && s.dateNumToday]}>{format(currentDate, 'd')}</Text>
          <Text style={s.dateSub}>{format(currentDate, 'EEEE, MMMM yyyy')}</Text>
        </View>
        <TouchableOpacity onPress={() => onNavigate(addDays(currentDate, 1))} style={s.navBtn}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Events */}
      {dayEvents.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No events — enjoy the free day!</Text>
        </View>
      ) : (
        <ScrollView style={s.list} contentContainerStyle={{ gap: spacing.sm }}>
          {dayEvents.map(event => (
            <TouchableOpacity
              key={event.id}
              style={s.card}
              onPress={() => onEventPress(event)}
              activeOpacity={0.7}
            >
              <View style={s.cardContent}>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle}>{event.title}</Text>
                  {event.description ? (
                    <Text style={s.cardDesc} numberOfLines={2}>{event.description}</Text>
                  ) : null}
                  {event.location ? (
                    <Text style={s.cardLocation}>📍 {event.location}</Text>
                  ) : null}
                </View>
                <View style={s.cardTime}>
                  {event.is_all_day ? (
                    <Text style={s.timeLabel}>All day</Text>
                  ) : event.start_datetime ? (
                    <>
                      <Text style={s.timeMain}>{format(new Date(event.start_datetime), 'HH:mm')}</Text>
                      {event.end_datetime && (
                        <Text style={s.timeEnd}>{format(new Date(event.end_datetime), 'HH:mm')}</Text>
                      )}
                    </>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navBtn: { padding: spacing.sm },
  navArrow: { fontSize: 22, color: colors.textSecondary },
  dateCenter: { alignItems: 'center' },
  dateNum: { fontSize: 36, fontWeight: '700', color: colors.text, lineHeight: 40 },
  dateNumToday: { color: colors.primary },
  dateSub: { fontSize: text.xs, color: colors.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: text.sm, color: colors.textTertiary },
  list: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardContent: { flexDirection: 'row', gap: spacing.sm },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: text.base, fontWeight: '600', color: colors.text },
  cardDesc: { fontSize: text.sm, color: colors.textSecondary },
  cardLocation: { fontSize: text.xs, color: colors.textTertiary },
  cardTime: { alignItems: 'flex-end', minWidth: 44 },
  timeLabel: { fontSize: text.xs, color: colors.textTertiary },
  timeMain: { fontSize: text.sm, fontWeight: '600', color: colors.primary },
  timeEnd: { fontSize: text.xs, color: colors.textTertiary },
})
