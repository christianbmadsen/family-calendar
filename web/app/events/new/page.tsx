'use client'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '@/lib/auth'
import { eventsApi } from '@/lib/api'
import Nav from '@/components/Nav'
import EventForm from '@/components/EventForm'
import type { EventCreate } from '@/lib/types'

export default function NewEventPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  async function handleSubmit(data: EventCreate) {
    await eventsApi.create(data)
    queryClient.invalidateQueries({ queryKey: ['events'] })
    router.push('/calendar')
  }

  if (!user) return null

  return (
    <>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">New event</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <EventForm
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            submitLabel="Add to calendar"
          />
        </div>
      </main>
    </>
  )
}
