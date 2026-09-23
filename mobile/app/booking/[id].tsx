import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStatusBadge } from '@/components/session/BookingStatusBadge';
import { BookingTimeline } from '@/components/session/BookingTimeline';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  approveBooking,
  cancelBooking,
  declineBooking,
  getBooking,
  markCompleted,
} from '@/services/bookingService';
import { ensureDirectChat } from '@/services/chatService';
import type { Booking } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import {
  SESSION_MODE_LABEL,
  formatDurationMins,
  formatSessionDate,
  formatSessionTime,
} from '@/utils/sessionFormat';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing booking.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getBooking(id);
      if (!next) {
        setError('This booking could not be found.');
        setBooking(null);
        return;
      }
      setBooking(next);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isTeacher = !!profile && !!booking && profile.uid === booking.teacherId;
  const isLearner = !!profile && !!booking && profile.uid === booking.learnerId;

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setActing(true);
    setError(null);
    try {
      await action();
      Alert.alert(successMessage);
      await load();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setActing(false);
    }
  }

  async function openDirectChat() {
    if (!profile || !booking || (!isTeacher && !isLearner)) return;

    const otherParticipant = isTeacher
      ? {
          uid: booking.learnerId,
          name: booking.learnerName,
          avatarUrl: booking.learnerAvatarUrl,
        }
      : {
          uid: booking.teacherId,
          name: booking.teacherName,
          avatarUrl: booking.teacherAvatarUrl,
        };

    setMessageError(null);
    setMessageLoading(true);
    try {
      const chatId = await ensureDirectChat(profile, otherParticipant);
      router.push({
        pathname: '../chat/[id]',
        params: { id: chatId, participantName: otherParticipant.name },
      });
    } catch (chatError) {
      setMessageError(errorMessage(chatError));
    } finally {
      setMessageLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Booking" showBack />
        <LoadingState label="Loading booking…" />
      </SafeAreaView>
    );
  }

  if (error && !booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Booking" showBack />
        <ErrorState message={error} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (!booking) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Booking detail" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Notice tone="error" message={error} /> : null}
        {messageError ? <Notice tone="error" message={messageError} /> : null}

        <Card>
          <View style={styles.block}>
            <Text style={styles.title}>{booking.sessionTitle}</Text>
            <SkillChip label={skillLabel(booking.skillTag)} />
            <BookingStatusBadge status={booking.status} />
          </View>

          <View style={styles.meta}>
            <MetaRow icon="calendar-outline" label="Date" value={formatSessionDate(booking.startAt)} />
            <MetaRow icon="time-outline" label="Time" value={formatSessionTime(booking.startAt)} />
            <MetaRow
              icon="hourglass-outline"
              label="Duration"
              value={formatDurationMins(booking.durationMins)}
            />
            <MetaRow
              icon={booking.mode === 'online' ? 'videocam-outline' : 'location-outline'}
              label="Mode"
              value={SESSION_MODE_LABEL[booking.mode]}
            />
            {booking.mode === 'in_person' && booking.locationText ? (
              <MetaRow icon="map-outline" label="Location" value={booking.locationText} />
            ) : null}
          </View>
        </Card>

        <Card>
          <BookingTimeline status={booking.status} />
        </Card>

        <View style={styles.personBlock}>
          <Text style={styles.sectionLabel}>Teacher</Text>
          <PersonRow
            name={booking.teacherName}
            avatarUrl={booking.teacherAvatarUrl}
            onPress={() => router.push(`/user/${booking.teacherId}`)}
          />
        </View>

        <View style={styles.personBlock}>
          <Text style={styles.sectionLabel}>Learner</Text>
          <PersonRow
            name={booking.learnerName}
            avatarUrl={booking.learnerAvatarUrl}
            onPress={() => router.push(`/user/${booking.learnerId}`)}
          />
        </View>

        {booking.note ? (
          <Card>
            <Text style={styles.sectionLabel}>Note</Text>
            <Text style={styles.body}>{booking.note}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          {booking.status === 'confirmed' && booking.mode === 'online' && booking.meetingLink ? (
            <Button
              label="Join Meeting"
              icon="videocam-outline"
              onPress={() => void Linking.openURL(booking.meetingLink)}
            />
          ) : null}

          {isTeacher || isLearner ? (
            <Button
              label={isTeacher ? 'Message learner' : 'Message teacher'}
              variant="secondary"
              icon="chatbubble-outline"
              loading={messageLoading}
              onPress={() => void openDirectChat()}
            />
          ) : null}

          {isLearner && booking.status === 'completed' ? (
            booking.reviewedByLearner ? (
              <Notice tone="success" message="You have already reviewed this session." />
            ) : (
              <Button
                label="Leave Review"
                variant="secondary"
                icon="star-outline"
                onPress={() =>
                  router.push({ pathname: '../review/[id]', params: { id: booking.id } })
                }
              />
            )
          ) : null}

          {isTeacher && booking.status === 'pending' ? (
            <>
              <Button
                label="Approve"
                loading={acting}
                onPress={() =>
                  void runAction(
                    () => approveBooking(booking.id, profile!.uid),
                    'Booking confirmed'
                  )
                }
              />
              <Button
                label="Decline"
                variant="danger"
                loading={acting}
                onPress={() =>
                  void runAction(
                    () => declineBooking(booking.id, profile!.uid),
                    'Booking declined'
                  )
                }
              />
            </>
          ) : null}

          {isTeacher && booking.status === 'confirmed' ? (
            <Button
              label="Mark completed"
              loading={acting}
              onPress={() =>
                void runAction(
                  () => markCompleted(booking.id, profile!.uid),
                  'Booking completed'
                )
              }
            />
          ) : null}

          {isLearner && (booking.status === 'pending' || booking.status === 'confirmed') ? (
            <Button
              label="Cancel booking"
              variant="secondary"
              loading={acting}
              onPress={() =>
                void runAction(
                  () => cancelBooking(booking.id, profile!.uid),
                  'Booking cancelled'
                )
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={sizes.iconSm} color={colors.inkMuted} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function PersonRow({
  name,
  avatarUrl,
  onPress,
}: {
  name: string;
  avatarUrl: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Open ${name}'s profile`} padded={false} style={styles.personCard}>
      <View style={styles.personRow}>
        <Avatar name={name} uri={avatarUrl || undefined} size="md" />
        <Text style={styles.personName}>{name}</Text>
        <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  block: {
    gap: spacing.sm,
  },
  title: {
    ...type.h1,
    color: colors.ink,
  },
  sectionLabel: {
    ...type.label,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  body: {
    ...type.body,
    color: colors.ink,
  },
  meta: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaLabel: {
    ...type.label,
    color: colors.inkMuted,
    width: sizes.avatarLg,
  },
  metaValue: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
  personBlock: {
    gap: spacing.sm,
  },
  personCard: {
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  personName: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
});
