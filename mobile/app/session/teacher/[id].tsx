import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionCard } from '@/components/session/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { requestBooking } from '@/services/bookingService';
import { listUpcomingSessions } from '@/services/sessionService';
import type { Session } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function TeacherSessionsScreen() {
  const { id, teacherName } = useLocalSearchParams<{ id: string; teacherName?: string }>();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setSessions(await listUpcomingSessions({ teacherId: id }));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
            Alert.alert('Request sent', 'You can track it under My Sessions.');
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
      <ScreenHeader
        title="Available Sessions"
        subtitle={teacherName ? `Upcoming sessions hosted by ${teacherName}.` : undefined}
        showBack
      />
      {loading ? (
        <LoadingState label="Loading available sessions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No sessions available"
              message="This teacher has no open sessions yet."
            />
          ) : (
            <View style={styles.list}>
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  ctaLabel="Book now"
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
});
