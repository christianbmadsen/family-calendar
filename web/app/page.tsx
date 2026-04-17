'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.push(user.family_id ? '/calendar' : '/onboarding')
    }
  }, [user, isLoading, router])

  const handleGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: 'openid email profile https://www.googleapis.com/auth/calendar',
    onSuccess: async ({ code }) => {
      try {
        const { is_new_user } = await login(code)
        router.push(is_new_user ? '/onboarding' : '/calendar')
      } catch {
        alert('Sign in failed. Please try again.')
      }
    },
    onError: () => alert('Google sign in failed. Please try again.'),
  })

  if (isLoading) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
      <div className="text-center space-y-8 px-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Family Calendar</h1>
          <p className="text-gray-500 text-lg">
            Your shared family schedule, reminders, and smart suggestions.
          </p>
        </div>

        <div className="space-y-3 text-sm text-gray-500">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-indigo-500">📅</span> Shared calendar synced with Google
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-indigo-500">🔔</span> Reminders 30 min before every event
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-indigo-500">✨</span> Weekly event & travel deal suggestions
          </div>
        </div>

        <button
          onClick={() => handleGoogleLogin()}
          className="inline-flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium shadow-sm hover:shadow-md transition-shadow"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p className="text-xs text-gray-400">
          Calendar access is required to sync your events.
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
