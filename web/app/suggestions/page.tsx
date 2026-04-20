'use client'
import { useRequireAuth } from '@/lib/auth'
import Nav from '@/components/Nav'

export default function SuggestionsPage() {
  useRequireAuth()

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-400 text-sm">
        Suggestions are not available in this version.
      </main>
    </>
  )
}
