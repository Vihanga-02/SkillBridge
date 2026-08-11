import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Session } from '@/types';
import {
  SESSION_MODE_LABEL,
  formatDurationMins,
  formatSessionDate,
  formatSessionTime,
} from '@/utils/sessionFormat';

type Props = {
  session: Session;
  onPress?: () => void;
  onActionPress?: () => void;
  ctaLabel?: string;
  bookingAction?: boolean;
  actionLoading?: boolean;
};

export function SessionCard({
  session,
  onPress,
  onActionPress,
  ctaLabel = 'View details',
  bookingAction = false,
  actionLoading = false,
}: Props) {
  const seatsLeft = Math.max(0, session.capacity - session.seatsTaken);
  const seatWarning = seatsLeft <= 1;

  return (
    <Card onPress={onActionPress ? onPress : undefined} accessibilityLabel={session.title}>
      <View style={styles.heading}>
        <View style={styles.skillIcon}>
          <Ionicons name="school-outline" size={sizes.iconMd} color={colors.accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {session.title}
          </Text>
          <SkillChip label={skillLabel(session.skillTag)} level={session.level} />
        </View>
      </View>

      {session.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {session.description}
        </Text>
      ) : null}

      <View style={styles.teacherRow}>
        <Avatar
          name={session.teacherName}
          uri={session.teacherAvatarUrl || undefined}
          size="sm"
        />
        <View style={styles.teacherText}>
          <Text style={styles.teacherName} numberOfLines={1}>
            {session.teacherName}
          </Text>
          {session.teacherRatingAvg > 0 ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={sizes.iconSm} color={colors.warning} />
              <Text style={styles.ratingText}>{session.teacherRatingAvg.toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={styles.ratingText}>New teacher</Text>
          )}
        </View>
      </View>

      <View style={styles.metaPanel}>
        <View style={styles.metaRow}>
          <Meta icon="calendar-outline" text={formatSessionDate(session.startAt)} />
          <Meta icon="time-outline" text={formatSessionTime(session.startAt)} />
        </View>
        <View style={styles.metaRow}>
          <Meta icon="hourglass-outline" text={formatDurationMins(session.durationMins)} />
          <Meta
            icon={session.mode === 'online' ? 'videocam-outline' : 'location-outline'}
            text={SESSION_MODE_LABEL[session.mode]}
          />
        </View>
      </View>

      <View style={[styles.seatPill, seatWarning && styles.seatPillWarning]}>
        <Ionicons
          name="people-outline"
          size={sizes.iconSm}
          color={seatWarning ? colors.danger : colors.inkMuted}
        />
        <Text style={[styles.seatText, seatWarning && styles.seatTextWarning]}>
          {seatsLeft === 0
            ? 'Session full'
            : `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`}
        </Text>
      </View>

      {onPress || onActionPress ? (
        <Button
          label={ctaLabel}
          variant={!bookingAction || seatsLeft > 0 ? 'primary' : 'secondary'}
          onPress={() => (onActionPress ?? onPress)?.()}
          loading={actionLoading}
          disabled={bookingAction && (session.status !== 'open' || seatsLeft === 0)}
          style={styles.cta}
        />
      ) : null}
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={sizes.iconSm} color={colors.inkMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  skillIcon: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
  title: { ...type.h2, color: colors.ink },
  description: { ...type.body, color: colors.inkMuted, marginTop: spacing.md },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  teacherText: { flex: 1 },
  teacherName: { ...type.label, color: colors.ink },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ratingText: { ...type.caption, color: colors.inkMuted },
  metaPanel: {
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.caption, color: colors.inkMuted, flex: 1 },
  seatPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  seatPillWarning: { backgroundColor: colors.bg },
  seatText: { ...type.caption, color: colors.inkMuted },
  seatTextWarning: { color: colors.danger },
  cta: { marginTop: spacing.lg },
});
