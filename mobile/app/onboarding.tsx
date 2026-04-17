import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { familyApi } from '@/lib/api'
import { colors, spacing, radius, text } from '@/lib/theme'

type Step = 'family' | 'done'

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('family')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [airport, setAirport] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setError('')
    setLoading(true)
    try {
      await familyApi.create({
        name,
        home_location: location,
        home_airport: airport.toUpperCase(),
      })
      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>Here's what to expect:</Text>
        <View style={styles.features}>
          {[
            ['🔔', 'Push alert 30 min before each event'],
            ['📋', 'Daily email with tomorrow\'s schedule at 8pm'],
            ['📆', 'Weekly digest every Sunday at 6pm'],
            ['✨', 'Event and travel suggestions every Monday'],
          ].map(([icon, desc]) => (
            <View key={desc} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{icon}</Text>
              <Text style={styles.featureText}>{desc}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)/calendar')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Go to calendar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Set up your family calendar</Text>
        <Text style={styles.subtitle}>This takes about a minute.</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Family name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. The Madsen Family"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Home city</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Copenhagen"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.hint}>Used to find local events near you.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Home airport (IATA code)</Text>
            <TextInput
              style={styles.input}
              value={airport}
              onChangeText={t => setAirport(t.toUpperCase())}
              placeholder="e.g. CPH"
              placeholderTextColor={colors.textTertiary}
              maxLength={3}
              autoCapitalize="characters"
            />
            <Text style={styles.hint}>Used to find flight deals for you.</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (!name || !location || !airport || loading) && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={!name || !location || !airport || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { fontSize: text.xxl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: text.base, color: colors.textSecondary },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: { fontSize: text.sm, fontWeight: '500', color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: text.sm,
    color: colors.text,
  },
  hint: { fontSize: text.xs, color: colors.textTertiary },
  error: { fontSize: text.sm, color: colors.danger },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: text.base, fontWeight: '600' },
  features: { gap: spacing.sm, marginVertical: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIcon: { fontSize: text.lg, width: 28 },
  featureText: { fontSize: text.sm, color: colors.textSecondary, flex: 1 },
})
