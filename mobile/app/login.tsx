import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri, ResponseType } from 'expo-auth-session'
import { useAuth } from '@/lib/auth'
import { colors, spacing, radius, text } from '@/lib/theme'

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth()

  const redirectUri = makeRedirectUri({ scheme: 'familycalendar', path: 'auth' })

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar',
    ],
    responseType: ResponseType.Code,
    redirectUri,
  })

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      handleCode(response.params.code)
    }
  }, [response])

  async function handleCode(code: string) {
    try {
      const { is_new_user } = await login(code, redirectUri)
      router.replace(is_new_user ? '/onboarding' : '/(tabs)/calendar')
    } catch {
      alert('Sign in failed. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (user) return null

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Family Calendar</Text>
        <Text style={styles.subtitle}>
          Your shared family schedule, reminders, and smart suggestions.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          ['📅', 'Shared calendar synced with Google'],
          ['🔔', 'Reminder 30 min before every event'],
          ['✨', 'Weekly event & travel suggestions'],
        ].map(([icon, label]) => (
          <View key={label} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !request && styles.buttonDisabled]}
        onPress={() => promptAsync()}
        disabled={!request}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Calendar access is required to sync your events.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm },
  title: { fontSize: text.xxl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: text.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  features: { gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIcon: { fontSize: text.lg, width: 28 },
  featureText: { fontSize: text.sm, color: colors.textSecondary },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: text.base, fontWeight: '600' },
  footnote: { fontSize: text.xs, color: colors.textTertiary, textAlign: 'center' },
})
