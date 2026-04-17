'use client'
import { addDays, subDays, format, isSameDay, isToday } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onNavigate: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export default function DayView({ currentDate, events, onNavigate, onEventClick }: Props) {
  const dayEvents = events
    .filter(e => e.start_datetime && isSameDay(new Date(e.start_datetime), currentDate))
    .sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1
      if (!a.is_all_day && b.is_all_day) return 1
      return new Date(a.start_datetime!).getTime() - new Date(b.start_datetime!).getTime()
    })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onNavigate(subDays(currentDate, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">←</button>
        <div className="text-center">
          <div className={`text-2xl font-bold ${isToday(currentDate) ? 'text-indigo-600' : 'text-gray-900'}`}>
            {format(currentDate, 'd')}
          </div>
          <div className="text-sm text-gray-500">{format(currentDate, 'EEEE, MMMM yyyy')}</div>
        </div>
        <button onClick={() => onNavigate(addDays(currentDate, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">→</button>
      </div>

      {/* Events */}
      {dayEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          No events — enjoy the free day!
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto">
          {dayEvents.map(event => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{event.title}</div>
                  {event.description && (
                    <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">{event.description}</div>
                  )}
                  {event.location && (
                    <div className="text-xs text-gray-400 mt-1">📍 {event.location}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {event.is_all_day ? (
                    <span className="text-xs text-gray-400">All day</span>
                  ) : (
                    <div className="text-sm font-medium text-indigo-600">
                      {format(new Date(event.start_datetime!), 'HH:mm')}
                      {event.end_datetime && (
                        <div className="text-xs text-gray-400 font-normal">
                          {format(new Date(event.end_datetime), 'HH:mm')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
