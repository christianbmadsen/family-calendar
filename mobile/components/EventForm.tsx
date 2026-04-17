import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Switch, Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { EventCreate, CalendarEvent } from '@/lib/types'
import { colors, spacing, radius, text } from '@/lib/theme'

interface Props {
  initial?: Partial<CalendarEvent>
  onSubmit: (data: EventCreate) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export default function EventForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save' }: Props) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [allDay, setAllDay] = useState(initial.is_all_day ?? false)
  const [startDate, setStartDate] = useState<Date | null>(
    initial.start_datetime ? new Date(initial.start_datetime) : null
  )
  const [endDate, setEndDate] = useState<Date | null>(
    initial.end_datetime ? new Date(initial.end_datetime) : null
  )
  const [location, setLocation] = useState(initial.location ?? '')
  const [references, setReferences] = useState(initial.references ?? '')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [startPickerMode, setStartPickerMode] = useState<'date' | 'time'>('date')
  const [endPickerMode, setEndPickerMode] = useState<'date' | 'time'>('date')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function formatDisplay(date: Date | null, includeTime: boolean) {
    if (!date) return 'Set date'
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    if (!includeTime) return dateStr
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} ${timeStr}`
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return }
    setError('')
    setLoading(true)
    try {
      const data: EventCreate = { title: title.trim() }
      if (description) data.description = description
      if (location) data.location = location
      if (references) data.references = references
      if (startDate) {
        const d = allDay ? new Date(startDate.setHours(0, 0, 0, 0)) : startDate
        data.start_datetime = d.toISOString()
      }
      if (endDate && !allDay) {
        data.end_datetime = endDate.toISOString()
      }
      await onSubmit(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.field}>
          <Text style={s.label}>Title *</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={s.row}>
          <Text style={s.label}>All-day event</Text>
          <Switch
            value={allDay}
            onValueChange={setAllDay}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>{allDay ? 'Date' : 'Start'}</Text>
          <TouchableOpacity
            style={s.datePicker}
            onPress={() => {
              setStartPickerMode('date')
              setShowStartPicker(true)
            }}
          >
            <Text style={startDate ? s.dateText : s.datePlaceholder}>
              {formatDisplay(startDate, !allDay)}
            </Text>
          </TouchableOpacity>
          {!allDay && startDate && (
            <TouchableOpacity
              style={[s.datePicker, { marginTop: spacing.xs }]}
              onPress={() => { setStartPickerMode('time'); setShowStartPicker(true) }}
            >
              <Text style={s.dateText}>
                {startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!allDay && (
          <View style={s.field}>
            <Text style={s.label}>End</Text>
            <TouchableOpacity
              style={s.datePicker}
              onPress={() => { setEndPickerMode('date'); setShowEndPicker(true) }}
            >
              <Text style={endDate ? s.dateText : s.datePlaceholder}>
                {formatDisplay(endDate, true)}
              </Text>
            </TouchableOpacity>
            {endDate && (
              <TouchableOpacity
                style={[s.datePicker, { marginTop: spacing.xs }]}
                onPress={() => { setEndPickerMode('time'); setShowEndPicker(true) }}
              >
                <Text style={s.dateText}>
                  {endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={s.field}>
          <Text style={s.label}>Location</Text>
          <TextInput
            style={s.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Optional"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>References</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={references}
            onChangeText={setReferences}
            placeholder="Links, notes, or any extra info"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={2}
          />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.buttons}>
          <TouchableOpacity
            style={[s.submitBtn, loading && s.disabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={s.submitText}>{loading ? 'Saving…' : submitLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showStartPicker && (
        <DateTimePicker
          value={startDate ?? new Date()}
          mode={startPickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowStartPicker(Platform.OS === 'ios')
            if (date) setStartDate(date)
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate ?? new Date()}
          mode={endPickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowEndPicker(Platform.OS === 'ios')
            if (date) setEndDate(date)
          }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  form: { padding: spacing.md, gap: spacing.md },
  field: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  datePicker: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dateText: { fontSize: text.sm, color: colors.text },
  datePlaceholder: { fontSize: text.sm, color: colors.textTertiary },
  error: { fontSize: text.sm, color: colors.danger },
  buttons: { gap: spacing.sm, paddingTop: spacing.sm },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: text.base, fontWeight: '600' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: text.base, color: colors.textSecondary },
})
