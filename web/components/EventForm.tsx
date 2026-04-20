'use client'
import { useState } from 'react'
import type { CalendarEvent, EventCreate } from '@/lib/types'

interface Props {
  initial?: Partial<CalendarEvent>
  onSubmit: (data: EventCreate) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

function pad(n: number) { return String(n).padStart(2, '0') }

function toLocalDate(utcStr: string): string {
  const d = new Date(utcStr)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toLocalTime(utcStr: string): string {
  const d = new Date(utcStr)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save' }: Props) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [allDay, setAllDay] = useState(initial.is_all_day ?? false)
  const [startDate, setStartDate] = useState(
    initial.start_datetime
      ? (initial.is_all_day ? initial.start_datetime.slice(0, 10) : toLocalDate(initial.start_datetime))
      : ''
  )
  const [startTime, setStartTime] = useState(
    initial.start_datetime && !initial.is_all_day ? toLocalTime(initial.start_datetime) : ''
  )
  const [endDate, setEndDate] = useState(
    initial.end_datetime
      ? (initial.is_all_day ? initial.end_datetime.slice(0, 10) : toLocalDate(initial.end_datetime))
      : ''
  )
  const [endTime, setEndTime] = useState(
    initial.end_datetime && !initial.is_all_day ? toLocalTime(initial.end_datetime) : ''
  )
  const [location, setLocation] = useState(initial.location ?? '')
  const [references, setReferences] = useState(initial.references ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data: EventCreate = { title }
      if (description) data.description = description
      if (location) data.location = location
      if (references) data.references = references

      if (startDate) {
        if (allDay) {
          data.start_datetime = `${startDate}T00:00:00Z`
        } else {
          data.start_datetime = new Date(`${startDate}T${startTime || '00:00'}:00`).toISOString()
        }
      }
      if (endDate && !allDay) {
        data.end_datetime = new Date(`${endDate}T${endTime || '00:00'}:00`).toISOString()
      }

      await onSubmit(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="Event title"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="allDay"
          type="checkbox"
          checked={allDay}
          onChange={e => setAllDay(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="allDay" className="text-sm text-gray-700">All-day event</label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {allDay ? 'Date' : 'Start date'}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {!allDay && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Optional"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">References</label>
        <textarea
          value={references}
          onChange={e => setReferences(e.target.value)}
          placeholder="Links, notes, or any extra info"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
