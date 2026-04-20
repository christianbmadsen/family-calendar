'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from './types'
import { authApi } from './api'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<{ is_new_user: boolean }>
  register: (email: string, password: string, name?: string) => Promise<{ is_new_user: boolean }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('auth_token')
    if (!stored) {
      setIsLoading(false)
      return
    }
    // Seed from cache immediately so the UI doesn't flash, then verify with the server
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      setToken(stored)
      setUser(JSON.parse(storedUser))
    }
    authApi.me()
      .then(freshUser => {
        setToken(stored)
        setUser(freshUser)
        localStorage.setItem('auth_user', JSON.stringify(freshUser))
      })
      .catch(() => {
        // Token expired or invalid — clear everything
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  function _persist(data: { access_token: string; user: User }) {
    localStorage.setItem('auth_token', data.access_token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
  }

  async function login(email: string, password: string): Promise<{ is_new_user: boolean }> {
    const data = await authApi.login(email, password)
    _persist(data)
    return { is_new_user: data.is_new_user }
  }

  async function register(email: string, password: string, name?: string): Promise<{ is_new_user: boolean }> {
    const data = await authApi.register(email, password, name)
    _persist(data)
    return { is_new_user: data.is_new_user }
  }

  function logout() {
    authApi.logout().catch(() => {})
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useRequireAuth() {
  const auth = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.push('/')
    }
  }, [auth.isLoading, auth.user, router])
  return auth
}
