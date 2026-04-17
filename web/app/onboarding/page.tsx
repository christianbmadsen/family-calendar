'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/lib/auth'
import { familyApi } from '@/lib/api'

type Step = 'family' | 'notifications'

export default function OnboardingPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('family')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [airport, setAirport] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await familyApi.create({ name, home_location: location, home_airport: airport.toUpperCase() })
      setStep('notifications')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFinish() {
    router.push('/calendar')
  }

  if (!user) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md space-y-6">

        {step === 'family' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Set up your family calendar</h1>
              <p className="text-gray-500 mt-1">This takes about a minute.</p>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Home city
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Copenhagen"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">Used to find local events near you.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Home airport (IATA code)
                </label>
                <input
                  type="text"
                  value={airport}
                  onChange={e => setAirport(e.target.value)}
                  placeholder="e.g. CPH"
                  maxLength={3}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">Used to find flight deals for you.</p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'notifications' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">You're all set!</h1>
              <p className="text-gray-500 mt-1">Here's what to expect:</p>
            </div>

            <ul className="space-y-3 text-sm text-gray-600">
              {[
                ['🔔', 'Push alert 30 minutes before each event'],
                ['📋', 'Daily email + push with tomorrow\'s schedule at 8pm'],
                ['📆', 'Weekly digest every Sunday at 6pm'],
                ['✨', 'Event and travel suggestions every Monday morning'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-start gap-2">
                  <span>{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-400">
              You can adjust notification preferences in Settings at any time.
            </p>

            <button
              onClick={handleFinish}
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
