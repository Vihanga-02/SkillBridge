import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '@/constants/theme';

type Props = {
  progress: number;
  completed?: boolean;
};

export function ProgressBar({ progress, completed = false }: Props) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Progress</Text>
      <View style={styles.row}>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: safeProgress }}>
          <View style={[styles.fill, { width: `${safeProgress}%` }]} />
        </View>
        <Text style={styles.percent}>{safeProgress}%</Text>
      </View>
      {completed ? <Text style={styles.completed}>✓ Completed</Text> : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    flex: 1,
    height: 10,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  percent: {
    ...type.label,
    color: colors.inkMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  completed: {
    ...type.bodyStrong,
    color: colors.success,
  },
});
