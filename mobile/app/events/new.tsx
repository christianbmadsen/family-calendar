import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import EventForm from '@/components/EventForm'
import type { EventCreate } from '@/lib/types'

export default function NewEventScreen() {
  const queryClient = useQueryClient()

  async function handleSubmit(data: EventCreate) {
    await eventsApi.create(data)
    queryClient.invalidateQueries({ queryKey: ['events'] })
    router.back()
  }

  return <EventForm onSubmit={handleSubmit} onCancel={() => router.back()} submitLabel="Add to calendar" />
}
