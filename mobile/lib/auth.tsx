import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { authApi, notificationsApi, setApiToken } from './api'
import type { User } from './types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (auth_code: string, redirect_uri: string) => Promise<{ is_new_user: boolean }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function registerPushToken() {
  if (!Device.isDevice) return
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) return

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await notificationsApi.registerPushToken(token)
  } catch {
    // Non-fatal — push token registration can be retried
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function restore() {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY)
        const storedUser = await SecureStore.getItemAsync(USER_KEY)
        if (token && storedUser) {
          setApiToken(token)
          setUser(JSON.parse(storedUser))
        }
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  async function login(auth_code: string, redirect_uri: string) {
    const data = await authApi.googleLogin(auth_code, redirect_uri)
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user))
    setApiToken(data.access_token)
    setUser(data.user)
    registerPushToken()
    return { is_new_user: data.is_new_user }
  }

  async function logout() {
    authApi.logout().catch(() => {})
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(USER_KEY)
    setApiToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
