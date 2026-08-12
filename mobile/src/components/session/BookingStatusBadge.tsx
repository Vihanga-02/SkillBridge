import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, statusColor, type } from '@/constants/theme';
import type { BookingStatus } from '@/types';
import { BOOKING_STATUS_LABEL } from '@/utils/sessionFormat';

type Props = {
  status: BookingStatus;
};

export function BookingStatusBadge({ status }: Props) {
  const color = statusColor[status] ?? colors.inkMuted;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{BOOKING_STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  label: {
    ...type.caption,
    fontWeight: '600',
  },
});
