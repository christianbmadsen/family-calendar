import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch, ScrollView, StyleSheet, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { familyApi, notificationsApi } from '@/lib/api'
import { colors, spacing, radius, text } from '@/lib/theme'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()

  const { data: family } = useQuery({ queryKey: ['family'], queryFn: familyApi.get, enabled: !!user })
  const { data: prefs } = useQuery({ queryKey: ['notif-prefs'], queryFn: notificationsApi.getPreferences, enabled: !!user })

  const [inviteEmail, setInviteEmail] = useState('')
  const [homeLocation, setHomeLocation] = useState(family?.home_location ?? '')
  const [homeAirport, setHomeAirport] = useState(family?.home_airport ?? '')

  if (!user || !family || !prefs) {
    return <View style={s.center}><Text style={s.loading}>Loading…</Text></View>
  }

  const isOwner = family.owner_id === user.id

  async function handleInvite() {
    if (!inviteEmail) return
    try {
      await familyApi.invite(inviteEmail)
      Alert.alert('Invited', `Invitation created for ${inviteEmail}.`)
      setInviteEmail('')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    }
  }

  async function handleSaveFamily() {
    try {
      await familyApi.update({ home_location: homeLocation, home_airport: homeAirport.toUpperCase() })
      queryClient.invalidateQueries({ queryKey: ['family'] })
      Alert.alert('Saved', 'Family settings updated.')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    }
  }

  async function togglePref(key: 'notify_push' | 'notify_email') {
    await notificationsApi.updatePreferences({ [key]: !prefs[key] })
    queryClient.invalidateQueries({ queryKey: ['notif-prefs'] })
  }

  async function handleRemoveMember(memberId: string) {
    Alert.alert('Remove member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await familyApi.removeMember(memberId)
          queryClient.invalidateQueries({ queryKey: ['family'] })
        },
      },
    ])
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Notifications */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Notifications</Text>
        {([
          ['notify_push', 'Push notifications', 'Real-time alerts on your phone'],
          ['notify_email', 'Email', 'Daily & weekly digests'],
        ] as [keyof typeof prefs, string, string][]).map(([key, label, desc]) => (
          <View key={key} style={s.prefRow}>
            <View style={s.prefText}>
              <Text style={s.prefLabel}>{label}</Text>
              <Text style={s.prefDesc}>{desc}</Text>
            </View>
            <Switch
              value={!!prefs[key]}
              onValueChange={() => togglePref(key)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>

      {/* Family members */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Family members</Text>
        {family.member_ids.map(memberId => (
          <View key={memberId} style={s.memberRow}>
            <Text style={s.memberName}>
              {memberId === user.id ? `${user.name} (you)` : memberId}
              {memberId === family.owner_id ? '  · Owner' : ''}
            </Text>
            {isOwner && memberId !== user.id && (
              <TouchableOpacity onPress={() => handleRemoveMember(memberId)}>
                <Text style={s.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {isOwner && (
          <View style={s.inviteRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Invite by Google email"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.inviteBtn} onPress={handleInvite}>
              <Text style={s.inviteBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Family settings (owner only) */}
      {isOwner && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Family settings</Text>
          <View style={s.field}>
            <Text style={s.label}>Home city</Text>
            <TextInput
              style={s.input}
              value={homeLocation}
              onChangeText={setHomeLocation}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Home airport (IATA)</Text>
            <TextInput
              style={s.input}
              value={homeAirport}
              onChangeText={t => setHomeAirport(t.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={handleSaveFamily}>
            <Text style={s.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={logout}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: text.sm, color: colors.textSecondary },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: text.base, fontWeight: '600', color: colors.text },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  prefText: { flex: 1, gap: 2 },
  prefLabel: { fontSize: text.sm, fontWeight: '500', color: colors.text },
  prefDesc: { fontSize: text.xs, color: colors.textTertiary },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  memberName: { fontSize: text.sm, color: colors.text },
  removeText: { fontSize: text.xs, color: colors.danger },
  inviteRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: text.sm, color: colors.text, backgroundColor: colors.background },
  inviteBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, justifyContent: 'center' },
  inviteBtnText: { color: '#fff', fontSize: text.sm, fontWeight: '600' },
  field: { gap: spacing.xs },
  label: { fontSize: text.sm, fontWeight: '500', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', marginTop: spacing.xs },
  saveBtnText: { color: '#fff', fontSize: text.sm, fontWeight: '600' },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.card },
  signOutText: { fontSize: text.base, color: colors.danger, fontWeight: '500' },
})
