import { useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { suggestionsApi, agentsApi } from '@/lib/api'
import { colors, spacing, radius, text } from '@/lib/theme'
import type { Suggestion } from '@/lib/types'

type Tab = 'opportunity' | 'travel_deal'

export default function SuggestionsScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('opportunity')
  const [running, setRunning] = useState(false)

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions', tab],
    queryFn: () => suggestionsApi.list(tab),
    enabled: !!user,
  })

  async function handleAccept(s: Suggestion) {
    await suggestionsApi.accept(s.id)
    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  async function handleDismiss(s: Suggestion) {
    await suggestionsApi.dismiss(s.id)
    queryClient.invalidateQueries({ queryKey: ['suggestions', tab] })
  }

  async function handleRefresh() {
    setRunning(true)
    try {
      if (tab === 'opportunity') await agentsApi.runOpportunities()
      else await agentsApi.runTravel()
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['suggestions', tab] })
        setRunning(false)
      }, 3000)
    } catch { setRunning(false) }
  }

  return (
    <View style={s.container}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {([['opportunity', '📍 Local events'], ['travel_deal', '✈️ Travel']] as [Tab, string][]).map(([t, label]) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={handleRefresh} disabled={running} style={s.refreshBtn}>
          {running
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={s.refreshText}>↻</Text>
          }
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : suggestions.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No suggestions right now.</Text>
          <Text style={s.emptyHint}>Tap ↻ to find new ones.</Text>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={s => s.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <SuggestionCard
              suggestion={item}
              onAccept={() => handleAccept(item)}
              onDismiss={() => handleDismiss(item)}
            />
          )}
        />
      )}
    </View>
  )
}

function SuggestionCard({
  suggestion: item,
  onAccept,
  onDismiss,
}: { suggestion: Suggestion; onAccept: () => void; onDismiss: () => void }) {
  const [loading, setLoading] = useState<'accept' | 'dismiss' | null>(null)

  async function handle(action: 'accept' | 'dismiss') {
    setLoading(action)
    try { if (action === 'accept') await onAccept(); else await onDismiss() }
    finally { setLoading(null) }
  }

  return (
    <View style={c.card}>
      <Text style={c.title}>{item.title}</Text>
      <Text style={c.date}>
        {format(new Date(item.start_datetime), 'EEE, MMM d')} – {format(new Date(item.end_datetime), 'MMM d')}
        {item.price ? `  ·  ${item.price}` : ''}
      </Text>
      <Text style={c.desc}>{item.description}</Text>
      {item.location ? <Text style={c.loc}>📍 {item.location}</Text> : null}
      <View style={c.btns}>
        <TouchableOpacity
          style={[c.acceptBtn, loading && c.disabled]}
          onPress={() => handle('accept')}
          disabled={!!loading}
          activeOpacity={0.8}
        >
          <Text style={c.acceptText}>{loading === 'accept' ? 'Adding…' : 'Add to calendar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[c.dismissBtn, loading && c.disabled]}
          onPress={() => handle('dismiss')}
          disabled={!!loading}
        >
          <Text style={c.dismissText}>{loading === 'dismiss' ? '…' : 'Dismiss'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.md },
  tab: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: text.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary },
  refreshBtn: { marginLeft: 'auto', justifyContent: 'center', paddingHorizontal: spacing.sm },
  refreshText: { fontSize: 20, color: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  emptyText: { fontSize: text.sm, color: colors.textSecondary },
  emptyHint: { fontSize: text.xs, color: colors.textTertiary },
  list: { padding: spacing.md, gap: spacing.md },
})

const c = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: text.base, fontWeight: '600', color: colors.text },
  date: { fontSize: text.xs, color: colors.primary, fontWeight: '500' },
  desc: { fontSize: text.sm, color: colors.textSecondary, lineHeight: 20 },
  loc: { fontSize: text.xs, color: colors.textTertiary },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  acceptBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  acceptText: { color: '#fff', fontSize: text.sm, fontWeight: '600' },
  dismissBtn: { paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  dismissText: { fontSize: text.sm, color: colors.textSecondary },
  disabled: { opacity: 0.5 },
})
