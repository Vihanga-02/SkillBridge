import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

import { Button } from '@/components/ui/Button';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  /** 'YYYY-MM-DD', or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  helper?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  /** Optional dates get a clear action. */
  clearable?: boolean;
};

/**
 * A calendar sheet rather than a typed date. Typing "2025-13-45" into a text
 * field is a validation problem you can simply not have, and `react-native-calendars`
 * is already a project dependency for the booking calendar.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  helper,
  placeholder = 'Select a date',
  minDate,
  maxDate,
  clearable = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const display = value ? format(new Date(`${value}T00:00:00`), 'd MMM yyyy') : placeholder;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value ? display : 'No date selected'}`}
        style={[styles.field, !!error && styles.fieldError]}>
        <Ionicons
          name="calendar-outline"
          size={sizes.iconMd}
          color={error ? colors.danger : colors.inkMuted}
        />
        <Text style={[styles.value, !value && styles.placeholder]}>{display}</Text>
        {clearable && value ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={sizes.iconMd} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </Pressable>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <Calendar
            current={value || undefined}
            minDate={minDate}
            maxDate={maxDate}
            markedDates={value ? { [value]: { selected: true, selectedColor: colors.accent } } : {}}
            onDayPress={(day: { dateString: string }) => {
              onChange(day.dateString);
              setOpen(false);
            }}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.inkMuted,
              monthTextColor: colors.ink,
              dayTextColor: colors.ink,
              textDisabledColor: colors.inkFaint,
              todayTextColor: colors.accent,
              selectedDayBackgroundColor: colors.accent,
              selectedDayTextColor: colors.inkInverse,
              arrowColor: colors.accent,
            }}
          />
          <Button label="Close" variant="secondary" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  value: {
    ...type.body,
    color: colors.ink,
    flex: 1,
  },
  placeholder: {
    color: colors.inkMuted,
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetTitle: {
    ...type.h2,
    color: colors.ink,
  },
});
