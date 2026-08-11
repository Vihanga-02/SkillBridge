import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStatusBadge } from '@/components/session/BookingStatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { RatingStars } from '@/components/ui/RatingStars';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getBookingForSession, requestBooking } from '@/services/bookingService';
import { getSession, listUpcomingSessions } from '@/services/sessionService';
import { getUser } from '@/services/userService';
import type { Booking, Session, User } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import {
  SESSION_MODE_LABEL,
  SESSION_TYPE_LABEL,
  formatDurationMins,
  formatLevel,
  formatSessionDate,
  formatSessionTime,
} from '@/utils/sessionFormat';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [teacherSessions, setTeacherSessions] = useState<Session[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const nextSession = await getSession(id);
      if (!nextSession) {
        setSession(null);
        setBooking(null);
        return;
      }
      const [nextBooking, nextTeacher, nextTeacherSessions] = await Promise.all([
        getBookingForSession(id, profile.uid),
        getUser(nextSession.teacherId),
        listUpcomingSessions({ teacherId: nextSession.teacherId }),
      ]);
      setSession(nextSession);
      setBooking(nextBooking);
      setTeacher(nextTeacher);
      setTeacherSessions(nextTeacherSessions);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile || loading) {
    return <LoadingState fullScreen label="Loading session…" />;
  }

  if (error && !session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Session" showBack />
        <ErrorState message={error} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Session" showBack />
        <ErrorState message="This session is no longer available." onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  const seatsLeft = Math.max(0, session.capacity - session.seatsTaken);
  const isTeacher = profile.uid === session.teacherId;
  const activeBooking =
    booking && ['pending', 'confirmed', 'completed'].includes(booking.status) ? booking : null;
  const canRequest =
    !isTeacher &&
    profile.role !== 'teacher' &&
    !activeBooking &&
    session.status === 'open' &&
    seatsLeft > 0 &&
    (session.startAt?.toMillis?.() ?? 0) > Date.now();

  async function submitRequest() {
    if (!session || !profile || !canRequest) return;
    setRequesting(true);
    setError(null);
    try {
      await requestBooking(session, profile, note);
      await load();
      Alert.alert('Request sent', 'The teacher can now approve or decline your booking.', [
        { text: 'Stay here' },
        { text: 'My bookings', onPress: () => router.replace('/(tabs)/sessions') },
      ]);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRequesting(false);
    }
  }

  function confirmRequest() {
    if (!session) return;
    const currentSession = session;
    Alert.alert(
      'Request this session?',
      `${formatSessionDate(currentSession.startAt)} at ${formatSessionTime(currentSession.startAt)} · ${formatDurationMins(currentSession.durationMins)}`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Send request', onPress: () => void submitRequest() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Session details" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Notice tone="error" message={error} /> : null}

        <Card
          onPress={() => router.push(`/user/${session.teacherId}`)}
          accessibilityLabel={`Open ${session.teacherName}'s profile`}>
          <View style={styles.profileTop}>
            <Avatar
              name={teacher?.name ?? session.teacherName}
              uri={teacher?.avatarUrl || session.teacherAvatarUrl || undefined}
              size="lg"
            />
            <View style={styles.profileText}>
              <Text style={styles.teacherName}>{teacher?.name ?? session.teacherName}</Text>
              <Text style={styles.skillLine}>{skillLabel(session.skillTag)} teacher</Text>
              <RatingStars
                rating={teacher?.ratingAvg ?? session.teacherRatingAvg}
                count={teacher?.ratingCount}
              />
              {teacher?.location ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkMuted} />
                  <Text style={styles.inlineText}>{teacher.location}</Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
          </View>
          {teacher?.bio ? <Text style={styles.teacherBio}>{teacher.bio}</Text> : null}
        </Card>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Available Sessions</Text>
          <Button
            label="View calendar"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/booking/calendar',
                params: { teacherId: session.teacherId, teacherName: session.teacherName },
              })
            }
          />
        </View>

        <Card>
          <View style={styles.heading}>
            <Text style={styles.title}>{session.title}</Text>
            <SkillChip label={skillLabel(session.skillTag)} level={session.level} />
          </View>
          <Text style={styles.description}>{session.description}</Text>

          <View style={styles.details}>
            <Detail icon="calendar-outline" label="Date" value={formatSessionDate(session.startAt)} />
            <Detail icon="time-outline" label="Time" value={formatSessionTime(session.startAt)} />
            <Detail icon="hourglass-outline" label="Duration" value={formatDurationMins(session.durationMins)} />
            <Detail icon="school-outline" label="Level" value={formatLevel(session.level)} />
            <Detail icon="people-outline" label="Type" value={SESSION_TYPE_LABEL[session.type]} />
            <Detail
              icon={session.mode === 'online' ? 'videocam-outline' : 'location-outline'}
              label="Mode"
              value={SESSION_MODE_LABEL[session.mode]}
            />
            {session.mode === 'in_person' ? (
              <Detail icon="map-outline" label="Location" value={session.locationText} />
            ) : null}
            <Detail
              icon="person-add-outline"
              label="Seats"
              value={`${seatsLeft} of ${session.capacity} available`}
            />
          </View>
        </Card>

        {teacherSessions.filter((item) => item.id !== session.id).map((item) => (
          <Card
            key={item.id}
            onPress={() => router.replace({ pathname: '/session/[id]', params: { id: item.id } })}
            accessibilityLabel={`Open ${item.title}`}>
            <View style={styles.otherSessionRow}>
              <View style={styles.otherSessionText}>
                <Text style={styles.otherSessionTitle}>{item.title}</Text>
                <Text style={styles.inlineText}>
                  {formatSessionDate(item.startAt)} · {formatSessionTime(item.startAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.accent} />
            </View>
          </Card>
        ))}

        {activeBooking ? (
          <Card>
            <View style={styles.bookingSummary}>
              <Text style={styles.sectionTitle}>Your booking</Text>
              <BookingStatusBadge status={activeBooking.status} />
              <Text style={styles.helper}>
                {activeBooking.status === 'pending'
                  ? 'Waiting for the teacher to respond.'
                  : activeBooking.status === 'confirmed'
                    ? 'Your seat is confirmed. Open the booking for joining details.'
                    : 'This booking is complete.'}
              </Text>
              <Button
                label="View booking"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/booking/[id]', params: { id: activeBooking.id } })
                }
              />
            </View>
          </Card>
        ) : isTeacher ? (
          <Notice tone="info" message="This is your own session. Manage requests from the Teaching tab." />
        ) : profile.role === 'teacher' ? (
          <Notice
            tone="info"
            message="Teacher-only profiles cannot book sessions. Switch to Teach & learn in Edit profile to book."
          />
        ) : (
          <View style={styles.requestBlock}>
            <Input
              label="Note to the teacher (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="What would you like help with?"
              maxLength={300}
              multiline
              helper={`${note.length}/300 characters`}
            />
            <Button
              label={seatsLeft === 0 ? 'Session full' : 'Request booking'}
              icon="calendar-outline"
              onPress={confirmRequest}
              loading={requesting}
              disabled={!canRequest}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={sizes.iconSm} color={colors.inkMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { gap: spacing.sm },
  title: { ...type.h1, color: colors.ink },
  description: { ...type.body, color: colors.ink, marginTop: spacing.lg },
  details: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailLabel: { ...type.label, color: colors.inkMuted, width: 72 },
  detailValue: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileText: { flex: 1, gap: spacing.xs },
  teacherName: { ...type.bodyStrong, color: colors.ink },
  skillLine: { ...type.label, color: colors.accent },
  teacherBio: { ...type.body, color: colors.inkMuted, marginTop: spacing.md },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  inlineText: { ...type.caption, color: colors.inkMuted },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otherSessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  otherSessionText: { flex: 1, gap: spacing.xs },
  otherSessionTitle: { ...type.bodyStrong, color: colors.ink },
  bookingSummary: { gap: spacing.md },
  sectionTitle: { ...type.h2, color: colors.ink },
  helper: { ...type.body, color: colors.inkMuted },
  requestBlock: { gap: spacing.lg },
});
