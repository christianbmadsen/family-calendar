'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const links = [
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/suggestions', label: 'Suggestions', icon: '✨' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Nav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-indigo-600">Family Calendar</span>
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{icon}</span>{label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.photo_url && (
            <img src={user.photo_url} alt={user.name} className="w-8 h-8 rounded-full" />
          )}
          <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
