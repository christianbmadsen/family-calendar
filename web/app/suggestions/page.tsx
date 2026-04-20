'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRequireAuth } from '@/lib/auth'
import { suggestionsApi } from '@/lib/api'
import Nav from '@/components/Nav'

export default function SuggestionsPage() {
  const { user } = useRequireAuth()
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: suggestionsApi.list,
    enabled: !!user,
  })

  async function handleGenerate() {
    setGenerating(true)
    setMsg('Generating… this usually takes 10–15 seconds.')
    try {
      await suggestionsApi.generate()
      // Poll every 3s up to 6 times (18s total) waiting for the background task to finish
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        await queryClient.invalidateQueries({ queryKey: ['suggestions'] })
        if (attempts >= 6) {
          clearInterval(poll)
          setGenerating(false)
          setMsg('')
        }
      }, 3000)
    } catch (err: any) {
      setMsg(err.message)
      setGenerating(false)
    }
  }

  async function handleAccept(id: string) {
    await suggestionsApi.accept(id)
    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  async function handleDismiss(id: string) {
    await suggestionsApi.dismiss(id)
    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Activity suggestions</h1>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating…' : 'Generate new'}
          </button>
        </div>

        {msg && <p className="text-sm text-indigo-600">{msg}</p>}

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !suggestions?.length ? (
          <div className="text-center py-16 text-gray-400 text-sm space-y-2">
            <p>No suggestions yet.</p>
            <p>Hit "Generate new" to get AI-powered activity ideas for your family.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {format(new Date(s.start_datetime), 'EEE, MMM d · h:mm a')}
                    {s.end_datetime && ` – ${format(new Date(s.end_datetime), 'h:mm a')}`}
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAccept(s.id)}
                    className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add to calendar
                  </button>
                  <button
                    onClick={() => handleDismiss(s.id)}
                    className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
