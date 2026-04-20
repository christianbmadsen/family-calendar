'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/lib/auth'
import { familyApi } from '@/lib/api'

type Step = 'family' | 'done'

export default function OnboardingPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('family')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await familyApi.create({ name })
      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md space-y-6">

        {step === 'family' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Set up your family calendar</h1>
              <p className="text-gray-500 mt-1">Just one step.</p>
            </div>

            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Family name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. The Madsen Family"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating…' : 'Create calendar'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">You're all set!</h1>
              <p className="text-gray-500 mt-1">Here's what to expect:</p>
            </div>

            <ul className="space-y-3 text-sm text-gray-600">
              {[
                ['📅', 'Shared calendar for the whole family'],
                ['📋', 'Daily email with tomorrow\'s schedule at 8pm'],
                ['📆', 'Weekly digest every Sunday at 6pm'],
                ['🔔', 'Email reminder 30 minutes before each event'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-start gap-2">
                  <span>{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-400">
              Invite family members from Settings after you've added some events.
            </p>

            <button
              onClick={() => router.push('/calendar')}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
            >
              Go to calendar
            </button>
          </>
        )}
      </div>
    </main>
  )
}
