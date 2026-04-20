'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '@/lib/auth'
import { familyApi, notificationsApi } from '@/lib/api'
import Nav from '@/components/Nav'

export default function SettingsPage() {
  const { user } = useRequireAuth()
  const queryClient = useQueryClient()

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
    enabled: !!user,
  })
  const { data: prefs } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: notificationsApi.getPreferences,
    enabled: !!user,
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')

  if (!user || !family || !prefs) return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8 text-gray-400 text-sm">Loading…</main>
    </>
  )

  const isOwner = family.owner_id === user.id

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    try {
      await familyApi.invite(inviteEmail)
      setInviteMsg(`Invitation created for ${inviteEmail}. Share your family join link with them.`)
      setInviteEmail('')
    } catch (err: any) {
      setInviteMsg(err.message)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this member?')) return
    await familyApi.removeMember(memberId)
    queryClient.invalidateQueries({ queryKey: ['family'] })
  }

  async function togglePref(key: 'notify_push' | 'notify_email') {
    await notificationsApi.updatePreferences({ [key]: !prefs?.[key] })
    queryClient.invalidateQueries({ queryKey: ['notif-prefs'] })
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* Notifications */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Notifications</h2>
          {([
            ['notify_push', 'Push notifications', 'Alerts on your phone'],
            ['notify_email', 'Email', 'Daily & weekly digests to your inbox'],
          ] as [keyof typeof prefs, string, string][]).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between py-2 border-t border-gray-100 first:border-0">
              <div>
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              <button
                onClick={() => togglePref(key)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  prefs[key] ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  prefs[key] ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </div>
          ))}
        </section>

        {/* Members */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Family members</h2>
          <div className="space-y-2">
            {family.member_ids.map(memberId => (
              <div key={memberId} className="flex items-center justify-between py-1.5">
                <div className="text-sm text-gray-700">
                  {memberId === user.id ? `${user.name} (you)` : memberId}
                  {memberId === family.owner_id && (
                    <span className="ml-2 text-xs text-gray-400">Owner</span>
                  )}
                </div>
                {isOwner && memberId !== user.id && (
                  <button
                    onClick={() => handleRemoveMember(memberId)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <form onSubmit={handleInvite} className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Invite by email"
                  required
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Invite
                </button>
              </div>
              {inviteMsg && <p className="text-sm text-indigo-600">{inviteMsg}</p>}
            </form>
          )}
        </section>
      </main>
    </>
  )
}
