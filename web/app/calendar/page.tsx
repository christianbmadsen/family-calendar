'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns'
import { useRequireAuth } from '@/lib/auth'
import { eventsApi } from '@/lib/api'
import Nav from '@/components/Nav'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import DayView from '@/components/calendar/DayView'
import type { CalendarEvent } from '@/lib/types'

type View = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  const { from, to } = dateRange(view, currentDate)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', from, to],
    queryFn: () => eventsApi.list(from, to),
    enabled: !!user,
  })

  function handleEventClick(event: CalendarEvent) {
    router.push(`/events/${event.id}`)
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date)
    setView('day')
  }

  async function handleSync() {
    await eventsApi.sync()
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  if (!user) return null

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['month', 'week', 'day'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 capitalize font-medium transition-colors ${
                  view === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              title="Sync with Google Calendar"
            >
              ↻ Sync
            </button>
            <button
              onClick={() => router.push('/events/new')}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Add event
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[600px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Loading…
            </div>
          ) : view === 'month' ? (
            <MonthView
              currentDate={currentDate}
              events={events}
              onNavigate={setCurrentDate}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          ) : view === 'week' ? (
            <WeekView
              currentDate={currentDate}
              events={events}
              onNavigate={setCurrentDate}
              onEventClick={handleEventClick}
            />
          ) : (
            <DayView
              currentDate={currentDate}
              events={events}
              onNavigate={setCurrentDate}
              onEventClick={handleEventClick}
            />
          )}
        </div>
      </main>
    </>
  )
}

function dateRange(view: View, date: Date) {
  if (view === 'month') {
    return {
      from: startOfMonth(date).toISOString(),
      to: endOfMonth(date).toISOString(),
    }
  }
  if (view === 'week') {
    return {
      from: startOfWeek(date).toISOString(),
      to: endOfWeek(date).toISOString(),
    }
  }
  return {
    from: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
    to: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
  }
}
