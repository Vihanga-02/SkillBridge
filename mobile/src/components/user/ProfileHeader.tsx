import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { RatingStars } from '@/components/ui/RatingStars';
import { colors, sizes, spacing, type } from '@/constants/theme';
import type { User, UserRole } from '@/types';
import { plural } from '@/utils/format';

const ROLE_LABEL: Record<UserRole, string> = {
  learner: 'Here to learn',
  teacher: 'Here to teach',
  both: 'Teaches and learns',
};

type Props = {
  user: User;
  /** Owner sees an edit action; a visitor sees the two CTAs. */
  isOwnProfile: boolean;
  onEdit?: () => void;
  onBook?: () => void;
  onMessage?: () => void;
  messageLoading?: boolean;
  /** Set while Components 3 and 4 are not built yet. */
  ctaDisabledReason?: string;
};

export function ProfileHeader({
  user,
  isOwnProfile,
  onEdit,
  onBook,
  onMessage,
  messageLoading = false,
  ctaDisabledReason,
}: Props) {
  return (
    <View style={styles.header}>
      <Avatar name={user.name} uri={user.avatarUrl || undefined} size="lg" />

      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.role}>{ROLE_LABEL[user.role]}</Text>

      <RatingStars rating={user.ratingAvg} count={user.ratingCount} />

      {user.location ? (
        <View style={styles.inlineRow}>
          <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkMuted} />
          <Text style={styles.meta}>{user.location}</Text>
        </View>
      ) : null}

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <View style={styles.badgeRow}>
        {user.verifiedSkills.length > 0 ? (
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={sizes.iconSm} color={colors.accent} />
            <Text style={styles.badgeText}>
              {plural(user.verifiedSkills.length, 'verified skill')}
            </Text>
          </View>
        ) : null}

        {user.credentialCount > 0 ? (
          <View style={styles.badge}>
            <Ionicons name="document-text-outline" size={sizes.iconSm} color={colors.inkMuted} />
            <Text style={styles.badgeText}>{plural(user.credentialCount, 'credential')}</Text>
          </View>
        ) : null}
      </View>

      {isOwnProfile ? (
        <Button
          label="Edit profile"
          variant="secondary"
          icon="create-outline"
          onPress={() => onEdit?.()}
          style={styles.action}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            label="Book a session"
            onPress={() => onBook?.()}
            disabled={!onBook}
            style={styles.actionHalf}
          />
          <Button
            label="Message"
            variant="secondary"
            onPress={() => onMessage?.()}
            loading={messageLoading}
            disabled={!onMessage}
            style={styles.actionHalf}
          />
        </View>
      )}

      {!isOwnProfile && ctaDisabledReason ? (
        <Text style={styles.meta}>{ctaDisabledReason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  name: {
    ...type.h1,
    color: colors.ink,
    textAlign: 'center',
  },
  role: {
    ...type.label,
    color: colors.inkMuted,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  bio: {
    ...type.body,
    color: colors.ink,
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    ...type.label,
    color: colors.inkMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
    paddingTop: spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
