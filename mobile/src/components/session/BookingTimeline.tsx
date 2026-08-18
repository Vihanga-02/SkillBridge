import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, type } from '@/constants/theme';
import type { BookingStatus } from '@/types';

type Props = {
  status: BookingStatus;
};

type TimelineStep = {
  label: string;
  state: 'complete' | 'current' | 'upcoming' | 'terminal';
};

function stepsFor(status: BookingStatus): TimelineStep[] {
  if (status === 'declined' || status === 'cancelled') {
    return [
      { label: 'Request sent', state: 'complete' },
      {
        label: status === 'declined' ? 'Request declined' : 'Booking cancelled',
        state: 'terminal',
      },
    ];
  }

  const confirmed = status === 'confirmed' || status === 'completed';
  const completed = status === 'completed';

  return [
    { label: 'Request sent', state: status === 'pending' ? 'current' : 'complete' },
    {
      label: 'Booking confirmed',
      state: completed ? 'complete' : confirmed ? 'current' : 'upcoming',
    },
    { label: 'Session completed', state: completed ? 'current' : 'upcoming' },
  ];
}

export function BookingTimeline({ status }: Props) {
  const steps = stepsFor(status);

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`Booking progress: ${steps
        .filter((step) => step.state !== 'upcoming')
        .map((step) => step.label)
        .join(', ')}`}>
      <Text style={styles.heading}>Booking progress</Text>

      <View>
        {steps.map((step, index) => {
          const isActive = step.state !== 'upcoming';
          const isTerminal = step.state === 'terminal';
          const color = isTerminal
            ? colors.danger
            : isActive
              ? colors.success
              : colors.border;
          const textColor = isTerminal
            ? colors.danger
            : isActive
              ? colors.ink
              : colors.inkMuted;

          return (
            <View key={step.label} style={styles.step}>
              <View style={styles.indicatorColumn}>
                <View style={[styles.circle, { backgroundColor: color, borderColor: color }]}>
                  {isActive ? (
                    <Ionicons
                      name={isTerminal ? 'close' : 'checkmark'}
                      size={sizes.iconSm}
                      color={colors.inkInverse}
                    />
                  ) : null}
                </View>
                {index < steps.length - 1 ? (
                  <View
                    style={[
                      styles.connector,
                      {
                        backgroundColor:
                          steps[index + 1].state !== 'upcoming' ? color : colors.border,
                      },
                    ]}
                  />
                ) : null}
              </View>

              <View style={styles.stepText}>
                <Text style={[styles.label, { color: textColor }]}>{step.label}</Text>
                {step.state === 'current' ? <Text style={styles.caption}>Current status</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  heading: {
    ...type.h2,
    color: colors.ink,
  },
  step: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    gap: spacing.md,
  },
  indicatorColumn: {
    width: sizes.iconLg,
    alignItems: 'center',
  },
  circle: {
    width: sizes.iconLg,
    height: sizes.iconLg,
    borderRadius: sizes.iconLg / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
  },
  stepText: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  label: {
    ...type.bodyStrong,
  },
  caption: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
