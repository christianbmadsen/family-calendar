'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRequireAuth } from '@/lib/auth'
import { suggestionsApi, agentsApi } from '@/lib/api'
import Nav from '@/components/Nav'
import type { Suggestion } from '@/lib/types'

type Tab = 'opportunity' | 'travel_deal'

export default function SuggestionsPage() {
  const { user } = useRequireAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('opportunity')
  const [running, setRunning] = useState(false)

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions', tab],
    queryFn: () => suggestionsApi.list(tab),
    enabled: !!user,
  })

  async function handleAccept(s: Suggestion) {
    await suggestionsApi.accept(s.id)
    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  async function handleDismiss(s: Suggestion) {
    await suggestionsApi.dismiss(s.id)
    queryClient.invalidateQueries({ queryKey: ['suggestions', tab] })
  }

  async function handleRunAgent() {
    setRunning(true)
    try {
      if (tab === 'opportunity') await agentsApi.runOpportunities()
      else await agentsApi.runTravel()
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['suggestions', tab] })
        setRunning(false)
      }, 3000)
    } catch {
      setRunning(false)
    }
  }

  if (!user) return null

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Suggestions</h1>
          <button
            onClick={handleRunAgent}
            disabled={running}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {running ? 'Finding…' : '↻ Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm mb-6 w-fit">
          {([['opportunity', '📍 Local events'], ['travel_deal', '✈️ Travel deals']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-sm text-center py-12">Loading…</div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-gray-400 text-sm">No suggestions right now.</div>
            <div className="text-gray-400 text-xs">Click Refresh to run the agent.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => handleAccept(s)}
                onDismiss={() => handleDismiss(s)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function SuggestionCard({
  suggestion: s,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion
  onAccept: () => void
  onDismiss: () => void
}) {
  const [loading, setLoading] = useState<'accept' | 'dismiss' | null>(null)

  async function handle(action: 'accept' | 'dismiss') {
    setLoading(action)
    try {
      if (action === 'accept') await onAccept()
      else await onDismiss()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{s.title}</h3>
          <div className="text-xs text-indigo-600 mt-0.5">
            {format(new Date(s.start_datetime), 'EEE, MMM d')}
            {' – '}
            {format(new Date(s.end_datetime), 'MMM d')}
            {s.price && <span className="ml-2 font-medium">{s.price}</span>}
          </div>
        </div>
        {s.source_url && (
          <a
            href={s.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          >
            View ↗
          </a>
        )}
      </div>

      <p className="text-sm text-gray-600">{s.description}</p>

      {s.location && (
        <div className="text-xs text-gray-400">📍 {s.location}</div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handle('accept')}
          disabled={!!loading}
          className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading === 'accept' ? 'Adding…' : 'Add to calendar'}
        </button>
        <button
          onClick={() => handle('dismiss')}
          disabled={!!loading}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading === 'dismiss' ? '…' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}
