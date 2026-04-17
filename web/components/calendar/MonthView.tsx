'use client'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameMonth, isSameDay, addMonths, subMonths, format, isToday,
} from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onNavigate: (date: Date) => void
  onDayClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MonthView({ currentDate, events, onNavigate, onDayClick, onEventClick }: Props) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startPad = getDay(monthStart)
  const padded = [...Array(startPad).fill(null), ...days]

  function eventsForDay(day: Date) {
    return events.filter(e => {
      const d = e.start_datetime ? new Date(e.start_datetime) : null
      return d && isSameDay(d, day)
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onNavigate(subMonths(currentDate, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
        <button
          onClick={() => onNavigate(addMonths(currentDate, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
        >
          →
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-gray-200">
        {padded.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} className="border-r border-b border-gray-200 bg-gray-50 min-h-[80px]" />
          }
          const dayEvents = eventsForDay(day)
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`border-r border-b border-gray-200 min-h-[80px] p-1 cursor-pointer hover:bg-indigo-50 transition-colors ${
                !inMonth ? 'bg-gray-50' : ''
              }`}
            >
              <div className={`text-sm w-7 h-7 flex items-center justify-center rounded-full mb-1 font-medium ${
                today ? 'bg-indigo-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event) }}
                    className="w-full text-left text-xs bg-indigo-100 text-indigo-700 rounded px-1 py-0.5 truncate hover:bg-indigo-200 transition-colors"
                  >
                    {event.is_all_day ? '' : (event.start_datetime ? format(new Date(event.start_datetime), 'HH:mm') + ' ' : '')}
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
