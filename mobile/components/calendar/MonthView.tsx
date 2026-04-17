import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameMonth, isSameDay, addMonths, subMonths, format, isToday,
} from 'date-fns'
import type { CalendarEvent } from '@/lib/types'
import { colors, spacing, text } from '@/lib/theme'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onNavigate: (date: Date) => void
  onDayPress: (date: Date) => void
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function MonthView({ currentDate, events, onNavigate, onDayPress }: Props) {
  const monthStart = startOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentDate) })
  const padded = [...Array(getDay(monthStart)).fill(null), ...days]

  function eventCount(day: Date) {
    return events.filter(e => e.start_datetime && isSameDay(new Date(e.start_datetime), day)).length
  }

  return (
    <View>
      {/* Navigation */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => onNavigate(subMonths(currentDate, 1))} style={s.navBtn}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{format(currentDate, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={() => onNavigate(addMonths(currentDate, 1))} style={s.navBtn}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day names */}
      <View style={s.grid}>
        {DAYS.map(d => (
          <View key={d} style={s.cell}>
            <Text style={s.dayName}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={s.grid}>
        {padded.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={s.cell} />
          const count = eventCount(day)
          const today = isToday(day)
          const inMonth = isSameMonth(day, currentDate)

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={s.cell}
              onPress={() => onDayPress(day)}
              activeOpacity={0.7}
            >
              <View style={[s.dayCircle, today && s.todayCircle]}>
                <Text style={[s.dayNum, !inMonth && s.dimmed, today && s.todayNum]}>
                  {format(day, 'd')}
                </Text>
              </View>
              {count > 0 && (
                <View style={s.dots}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <View key={j} style={s.dot} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  navBtn: { padding: spacing.sm },
  navArrow: { fontSize: 22, color: colors.textSecondary },
  monthLabel: { fontSize: text.lg, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayName: { fontSize: text.xs, color: colors.textTertiary, fontWeight: '500' },
  dayCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  todayCircle: { backgroundColor: colors.primary },
  dayNum: { fontSize: text.sm, color: colors.text },
  dimmed: { color: colors.textTertiary },
  todayNum: { color: '#fff', fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 2, marginTop: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
})
