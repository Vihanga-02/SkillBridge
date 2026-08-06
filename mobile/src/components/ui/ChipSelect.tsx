import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { colors, spacing, type } from '@/constants/theme';

export type ChipOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
  helper?: string;
};

/**
 * A single-choice field made of chips. Used instead of a native picker so the
 * options are all visible at once and the chip styling matches the filters
 * elsewhere in the app — one interaction pattern for "choose from a fixed set".
 */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  helper,
}: Props<T>) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.options}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
