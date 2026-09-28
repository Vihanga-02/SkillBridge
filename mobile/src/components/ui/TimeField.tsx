import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  /** 24-hour `HH:mm`; the picker displays it using 12-hour AM/PM format. */
  value: string;
  onChange: (value: string) => void;
  helper?: string;
};

function valueToDate(value: string): Date {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateToValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimeField({ label, value, onChange, helper }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const selectedTime = valueToDate(value);
  const display = format(selectedTime, 'h:mm a');

  function updateTime(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) onChange(dateToValue(selected));
  }

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedTime,
        mode: 'time',
        display: 'spinner',
        is24Hour: false,
        onChange: updateTime,
      });
      return;
    }
    setIosOpen(true);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${display}`}
        style={styles.field}>
        <Ionicons name="time-outline" size={sizes.iconMd} color={colors.inkMuted} />
        <Text style={styles.value}>{display}</Text>
        <Ionicons name="chevron-down" size={sizes.iconSm} color={colors.inkMuted} />
      </Pressable>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIosOpen(false)}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setIosOpen(false)}
            accessibilityLabel="Close"
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="spinner"
              is24Hour={false}
              onChange={updateTime}
            />
            <Button label="Done" onPress={() => setIosOpen(false)} />
          </View>
        </Modal>
      ) : null}
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
  value: {
    ...type.body,
    color: colors.ink,
    flex: 1,
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
