'use client'
import {
  startOfWeek, addDays, format, isSameDay, addWeeks, subWeeks, isToday,
} from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onNavigate: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6am–10pm

export default function WeekView({ currentDate, events, onNavigate, onEventClick }: Props) {
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function timedEventsForDay(day: Date) {
    return events.filter(e => {
      if (e.is_all_day || !e.start_datetime) return false
      return isSameDay(new Date(e.start_datetime), day)
    })
  }

  function allDayEventsForDay(day: Date) {
    return events.filter(e => {
      if (!e.is_all_day || !e.start_datetime) return false
      return isSameDay(new Date(e.start_datetime), day)
    })
  }

  function topPct(datetime: string) {
    const d = new Date(datetime)
    const minutes = (d.getHours() - 6) * 60 + d.getMinutes()
    return Math.max(0, (minutes / (17 * 60)) * 100)
  }

  function heightPct(start: string, end?: string) {
    if (!end) return (60 / (17 * 60)) * 100
    const s = new Date(start), e = new Date(end)
    const mins = (e.getTime() - s.getTime()) / 60000
    return Math.max((30 / (17 * 60)) * 100, (mins / (17 * 60)) * 100)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onNavigate(subWeeks(currentDate, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">←</button>
        <span className="text-sm font-medium text-gray-600">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button onClick={() => onNavigate(addWeeks(currentDate, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">→</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-200">
        <div />
        {days.map(day => (
          <div key={day.toISOString()} className={`text-center py-1.5 text-sm font-medium ${isToday(day) ? 'text-indigo-600' : 'text-gray-600'}`}>
            <div>{format(day, 'EEE')}</div>
            <div className={`text-lg font-semibold ${isToday(day) ? 'text-indigo-600' : 'text-gray-900'}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-200 min-h-[28px]">
        <div className="text-xs text-gray-400 flex items-center justify-center">all‑day</div>
        {days.map(day => (
          <div key={day.toISOString()} className="border-l border-gray-100 px-0.5 py-0.5 space-y-0.5">
            {allDayEventsForDay(day).map(e => (
              <button key={e.id} onClick={() => onEventClick(e)}
                className="w-full text-left text-xs bg-indigo-100 text-indigo-700 rounded px-1 truncate hover:bg-indigo-200">
                {e.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 48}px` }}>
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((h, i) => (
              <div key={h} className="absolute w-full text-right pr-2 text-xs text-gray-400" style={{ top: `${i * 48}px` }}>
                {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => (
            <div key={day.toISOString()} className="border-l border-gray-100 relative">
              {HOURS.map((_, i) => (
                <div key={i} className="border-t border-gray-100 absolute w-full" style={{ top: `${i * 48}px`, height: '48px' }} />
              ))}
              {timedEventsForDay(day).map(e => (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="absolute left-0.5 right-0.5 bg-indigo-500 text-white text-xs rounded px-1 py-0.5 text-left overflow-hidden hover:bg-indigo-600 transition-colors"
                  style={{
                    top: `${topPct(e.start_datetime!)}%`,
                    height: `${heightPct(e.start_datetime!, e.end_datetime)}%`,
                    minHeight: '20px',
                  }}
                >
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="opacity-80">{format(new Date(e.start_datetime!), 'HH:mm')}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
