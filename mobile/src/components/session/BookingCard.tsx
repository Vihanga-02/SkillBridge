import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { BookingStatusBadge } from '@/components/session/BookingStatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Booking } from '@/types';
import {
  SESSION_MODE_LABEL,
  formatDurationMins,
  formatSessionDate,
  formatSessionTime,
} from '@/utils/sessionFormat';

type Props = {
  booking: Booking;
  counterpart: string;
  counterpartAvatarUrl?: string;
  onPress: () => void;
};

export function BookingCard({
  booking,
  counterpart,
  counterpartAvatarUrl,
  onPress,
}: Props) {
  return (
    <Card accessibilityLabel={`Open ${booking.sessionTitle} booking`}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{booking.sessionTitle}</Text>
          <Text style={styles.skill}>{booking.skillTag}</Text>
        </View>
        <BookingStatusBadge status={booking.status} />
      </View>

      <View style={styles.schedule}>
        <View style={styles.dateBlock}>
          <Text style={styles.time}>{formatSessionTime(booking.startAt)}</Text>
          <Text style={styles.date}>{formatSessionDate(booking.startAt)}</Text>
        </View>
        <View style={styles.scheduleMeta}>
          <Meta icon="hourglass-outline" text={formatDurationMins(booking.durationMins)} />
          <Meta
            icon={booking.mode === 'online' ? 'videocam-outline' : 'location-outline'}
            text={SESSION_MODE_LABEL[booking.mode]}
          />
        </View>
      </View>

      <View style={styles.personRow}>
        <Avatar
          name={counterpart}
          uri={counterpartAvatarUrl || undefined}
          size="sm"
        />
        <Text style={styles.counterpart} numberOfLines={1}>
          {counterpart}
        </Text>
      </View>

      <Button label="View details" variant="secondary" onPress={onPress} style={styles.cta} />
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={sizes.iconSm} color={colors.inkMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleBlock: { flex: 1, gap: spacing.xs },
  title: { ...type.h2, color: colors.ink },
  skill: { ...type.caption, color: colors.accent, textTransform: 'capitalize' },
  schedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  dateBlock: {
    paddingRight: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: colors.border,
  },
  time: { ...type.h1, color: colors.ink },
  date: { ...type.caption, color: colors.inkMuted },
  scheduleMeta: { flex: 1, gap: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.caption, color: colors.inkMuted },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  counterpart: { ...type.label, color: colors.ink, flex: 1 },
  cta: { marginTop: spacing.md },
});
