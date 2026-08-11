import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionCard } from '@/components/session/SessionCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { requestBooking } from '@/services/bookingService';
import { listUpcomingSessions } from '@/services/sessionService';
import type { Session } from '@/types';
import { errorMessage } from '@/utils/authErrors';

const dateKey = (session: Session) => format(session.startAt.toDate(), 'yyyy-MM-dd');

export default function BookingCalendarScreen() {
  const { teacherId, teacherName } = useLocalSearchParams<{
    teacherId: string;
    teacherName?: string;
  }>();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listUpcomingSessions({ teacherId });
      setSessions(rows);
      setSelectedDate((current) => current || (rows[0] ? dateKey(rows[0]) : format(new Date(), 'yyyy-MM-dd')));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    sessions.forEach((session) => {
      marks[dateKey(session)] = {
        marked: true,
        dotColor: colors.accent,
      };
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: colors.accent,
    };
    return marks;
  }, [selectedDate, sessions]);

  const selectedSessions = sessions.filter((session) => dateKey(session) === selectedDate);

  function confirmBooking(session: Session) {
    if (!profile) return;
    Alert.alert('Book this session?', `Send a booking request to ${session.teacherName}?`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Book',
        onPress: async () => {
          setActingId(session.id);
          try {
            await requestBooking(session, profile, '');
            Alert.alert('Request sent', 'You can track it under My Sessions.', [
              { text: 'OK', onPress: () => router.replace('/(tabs)/sessions') },
            ]);
          } catch (requestError) {
            Alert.alert('Could not book', errorMessage(requestError));
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Calendar" subtitle={teacherName ? `${teacherName}'s availability` : undefined} showBack />
      {loading ? (
        <LoadingState label="Loading calendar…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <Calendar
              current={selectedDate}
              markedDates={markedDates}
              onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
              enableSwipeMonths
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.inkMuted,
                selectedDayBackgroundColor: colors.accent,
                selectedDayTextColor: colors.inkInverse,
                todayTextColor: colors.accent,
                dayTextColor: colors.ink,
                textDisabledColor: colors.inkFaint,
                dotColor: colors.accent,
                selectedDotColor: colors.inkInverse,
                arrowColor: colors.accent,
                monthTextColor: colors.ink,
              }}
            />
            <View style={styles.legend}>
              <View style={styles.dot} />
              <Text style={styles.legendText}>Available session</Text>
            </View>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability for {formatSelectedDate(selectedDate)}</Text>
            {selectedSessions.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No availability"
                message="Choose a marked date to see bookable sessions."
              />
            ) : (
              <View style={styles.list}>
                {selectedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    ctaLabel="Book"
                    bookingAction
                    actionLoading={actingId === session.id}
                    onPress={() =>
                      router.push({ pathname: '/session/[id]', params: { id: session.id } })
                    }
                    onActionPress={() => confirmBooking(session)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatSelectedDate(value: string) {
  if (!value) return 'selected date';
  const [year, month, day] = value.split('-').map(Number);
  return format(new Date(year, month - 1, day), 'MMM d');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  legendText: { ...type.caption, color: colors.inkMuted },
  section: { gap: spacing.md },
  sectionTitle: { ...type.h2, color: colors.ink },
  list: { gap: spacing.md },
});
