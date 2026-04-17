'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRequireAuth } from '@/lib/auth'
import { eventsApi } from '@/lib/api'
import Nav from '@/components/Nav'
import EventForm from '@/components/EventForm'
import type { EventCreate } from '@/lib/types'

export default function EventDetailPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(id),
    enabled: !!user && !!id,
  })

  async function handleUpdate(data: EventCreate) {
    await eventsApi.update(id, data)
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this event?')) return
    await eventsApi.delete(id)
    queryClient.invalidateQueries({ queryKey: ['events'] })
    router.push('/calendar')
  }

  if (!user || isLoading) return (
    <>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-8 text-gray-400 text-sm">Loading…</main>
    </>
  )

  if (!event) return (
    <>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-8 text-gray-400 text-sm">Event not found.</main>
    </>
  )

  return (
    <>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-8">
        {editing ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit event</h1>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <EventForm
                initial={event}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(false)}
                submitLabel="Save changes"
              />
            </div>
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Date / time */}
            <div className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
              {event.is_all_day ? (
                <span>
                  All day — {event.start_datetime ? format(new Date(event.start_datetime), 'EEEE, MMMM d yyyy') : 'No date'}
                </span>
              ) : event.start_datetime ? (
                <span>
                  {format(new Date(event.start_datetime), 'EEEE, MMMM d yyyy')}
                  {' · '}
                  {format(new Date(event.start_datetime), 'HH:mm')}
                  {event.end_datetime && ` – ${format(new Date(event.end_datetime), 'HH:mm')}`}
                </span>
              ) : 'No date set'}
            </div>

            {event.location && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <span>📍</span>
                <span>{event.location}</span>
              </div>
            )}

            {event.description && (
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {event.references && (
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">References</div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.references}</p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to calendar
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
