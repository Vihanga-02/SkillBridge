import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/session/BookingCard';
import { SessionCard } from '@/components/session/SessionCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CATEGORIES, skillLabel, type Category } from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  approveBooking,
  declineBooking,
  requestBooking,
  subscribeToMyBookings,
} from '@/services/bookingService';
import { getSessionsByTeacher, listUpcomingSessions } from '@/services/sessionService';
import type { Booking, Session } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type SessionsView = 'browse' | 'bookings' | 'teaching';
type BookingFilter = 'upcoming' | 'past' | 'cancelled';
type TeachingView = 'requests' | 'upcoming';

export default function SessionsScreen() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const teacherOnly = profile?.role === 'teacher';
  const dualRole = profile?.role === 'both';
  const canTeach = teacherOnly || dualRole;

  const [view, setView] = useState<SessionsView>('browse');
  const [teachingViewTab, setTeachingViewTab] = useState<TeachingView>('requests');
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('upcoming');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [myOffers, setMyOffers] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const [browseRows, offerRows] = await Promise.all([
        !teacherOnly ? listUpcomingSessions() : Promise.resolve([]),
        canTeach ? getSessionsByTeacher(profile.uid) : Promise.resolve([]),
      ]);
      setSessions(browseRows);
      setMyOffers(offerRows);
    } catch (loadError) {
      setSessionsError(errorMessage(loadError));
    } finally {
      setSessionsLoading(false);
    }
  }, [canTeach, profile, teacherOnly]);

  useFocusEffect(useCallback(() => void loadSessions(), [loadSessions]));

  useEffect(() => {
    if (!uid) return;
    setBookingsLoading(true);
    setBookingsError(null);
    return subscribeToMyBookings(
      uid,
      (rows) => {
        setBookings(rows);
        setBookingsLoading(false);
        setBookingsError(null);
      },
      (subscribeError) => {
        setBookingsLoading(false);
        setBookingsError(errorMessage(subscribeError));
      }
    );
  }, [subscriptionRevision, uid]);

  const learnerBookings = useMemo(
    () => bookings.filter((booking) => booking.learnerId === uid),
    [bookings, uid]
  );
  const upcomingBookings = learnerBookings.filter((booking) =>
    ['pending', 'confirmed'].includes(booking.status)
  );
  const pastBookings = learnerBookings.filter((booking) => booking.status === 'completed');
  const cancelledBookings = learnerBookings.filter((booking) =>
    ['cancelled', 'declined'].includes(booking.status)
  );
  const teachingBookings = useMemo(
    () => bookings.filter((booking) => booking.teacherId === uid),
    [bookings, uid]
  );
  const pendingRequests = teachingBookings.filter((booking) => booking.status === 'pending');
  const scheduledTeaching = teachingBookings.filter((booking) => booking.status === 'confirmed');
  const upcomingOffers = myOffers.filter(
    (session) =>
      ['open', 'full'].includes(session.status) &&
      (session.startAt?.toMillis?.() ?? 0) > Date.now()
  );
  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((session) => {
      const searchable = `${session.title} ${session.teacherName} ${skillLabel(session.skillTag)}`.toLowerCase();
      return (!category || session.category === category) && (!term || searchable.includes(term));
    });
  }, [category, search, sessions]);

  const filteredBookings =
    bookingFilter === 'upcoming'
      ? upcomingBookings
      : bookingFilter === 'past'
        ? pastBookings
        : cancelledBookings;

  async function onApprove(booking: Booking) {
    if (!profile) return;
    setActingId(booking.id);
    setBookingsError(null);
    try {
      await approveBooking(booking.id, profile.uid);
    } catch (actionError) {
      setBookingsError(errorMessage(actionError));
    } finally {
      setActingId(null);
    }
  }

  async function onDecline(booking: Booking) {
    if (!profile) return;
    setActingId(booking.id);
    setBookingsError(null);
    try {
      await declineBooking(booking.id, profile.uid);
    } catch (actionError) {
      setBookingsError(errorMessage(actionError));
    } finally {
      setActingId(null);
    }
  }

  function confirmQuickBooking(session: Session) {
    if (!profile) return;
    Alert.alert('Book this session?', `Send a booking request to ${session.teacherName}?`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Book',
        onPress: async () => {
          setActingId(session.id);
          setBookingsError(null);
          try {
            await requestBooking(session, profile, '');
            Alert.alert('Request sent', 'You can track it under My Sessions.');
            setView('bookings');
          } catch (requestError) {
            Alert.alert('Could not book', errorMessage(requestError));
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  if (!profile) return <LoadingState fullScreen label="Loading…" />;

  const teachingView = teacherOnly || (dualRole && view === 'teaching');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={teacherOnly ? 'Teacher Sessions' : 'Sessions'}
        subtitle={
          teacherOnly
            ? 'Create sessions and manage learner requests.'
            : 'Learn something new or share your skills.'
        }
        action={
          canTeach ? (
            <Button label="Create" variant="ghost" onPress={() => router.push('/session/create')} />
          ) : undefined
        }
      />

      {!teacherOnly ? (
        <View style={styles.segment}>
          <SegmentButton label="Browse" selected={view === 'browse'} onPress={() => setView('browse')} />
          <SegmentButton
            label="My Sessions"
            selected={view === 'bookings'}
            onPress={() => setView('bookings')}
          />
          {dualRole ? (
            <SegmentButton
              label="Teaching"
              selected={view === 'teaching'}
              onPress={() => setView('teaching')}
            />
          ) : null}
        </View>
      ) : null}

      {bookingsError ? (
        <View style={styles.noticeWrap}>
          <Notice tone="error" message={bookingsError} />
          <Button
            label="Retry"
            variant="ghost"
            onPress={() => setSubscriptionRevision((value) => value + 1)}
          />
        </View>
      ) : null}

      {!teacherOnly && view === 'browse' && sessionsLoading ? (
        <LoadingState label="Loading sessions…" />
      ) : null}
      {!teacherOnly && view === 'browse' && !sessionsLoading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sessionsError ? <Notice tone="error" message={sessionsError} /> : null}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={sizes.iconMd} color={colors.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search sessions, skills or teachers"
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              accessibilityLabel="Search sessions"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            <Chip size="sm" label="All" selected={!category} onPress={() => setCategory(null)} />
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                size="sm"
                label={item}
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>
          {visibleSessions.length === 0 ? (
            <EmptyState icon="search-outline" title="No sessions found" message="Try another search or category." />
          ) : (
            <SessionCards sessions={visibleSessions} onBook={confirmQuickBooking} actingId={actingId} />
          )}
        </ScrollView>
      ) : null}

      {!teacherOnly && view === 'bookings' && bookingsLoading ? (
        <LoadingState label="Loading your bookings…" />
      ) : null}
      {!teacherOnly && view === 'bookings' && !bookingsLoading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <Chip size="sm" label="Upcoming" selected={bookingFilter === 'upcoming'} onPress={() => setBookingFilter('upcoming')} />
            <Chip size="sm" label="Past Sessions" selected={bookingFilter === 'past'} onPress={() => setBookingFilter('past')} />
            <Chip size="sm" label="Cancelled" selected={bookingFilter === 'cancelled'} onPress={() => setBookingFilter('cancelled')} />
          </View>
          <BookingList
            title={
              bookingFilter === 'upcoming'
                ? 'Upcoming Sessions'
                : bookingFilter === 'past'
                  ? 'Past Sessions'
                  : 'Cancelled Sessions'
            }
            bookings={filteredBookings}
            counterpartRole="teacher"
          />
        </ScrollView>
      ) : null}

      {teachingView && (sessionsLoading || bookingsLoading) ? (
        <LoadingState label="Loading teaching activity…" />
      ) : null}
      {teachingView && !sessionsLoading && !bookingsLoading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sessionsError ? <Notice tone="error" message={sessionsError} /> : null}
          <View style={styles.teachingTabs}>
            <SegmentButton
              label={`Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`}
              selected={teachingViewTab === 'requests'}
              onPress={() => setTeachingViewTab('requests')}
            />
            <SegmentButton
              label="Upcoming"
              selected={teachingViewTab === 'upcoming'}
              onPress={() => setTeachingViewTab('upcoming')}
            />
          </View>

          {teachingViewTab === 'requests' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Booking Requests</Text>
                {pendingRequests.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{pendingRequests.length}</Text>
                  </View>
                ) : null}
              </View>
              {pendingRequests.length === 0 ? (
                <EmptyState
                  icon="mail-open-outline"
                  title="No booking requests"
                  message="New learner requests appear here."
                />
              ) : (
                <View style={styles.list}>
                  {pendingRequests.map((booking) => (
                    <View key={booking.id} style={styles.requestBlock}>
                      <BookingCard
                        booking={booking}
                        counterpart={booking.learnerName}
                        counterpartAvatarUrl={booking.learnerAvatarUrl}
                        onPress={() => openBooking(booking.id)}
                      />
                      <View style={styles.requestActions}>
                        <Button
                          label="Accept"
                          loading={actingId === booking.id}
                          onPress={() => void onApprove(booking)}
                          style={styles.actionHalf}
                        />
                        <Button
                          label="Decline"
                          variant="danger"
                          loading={actingId === booking.id}
                          onPress={() => void onDecline(booking)}
                          style={styles.actionHalf}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              {scheduledTeaching.length > 0 ? (
                <BookingList
                  title="Confirmed Learners"
                  bookings={scheduledTeaching}
                  counterpartRole="learner"
                />
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
                {upcomingOffers.length === 0 ? (
                  <EmptyState
                    icon="calendar-outline"
                    title="No upcoming sessions"
                    message="Create a session and let learners request a seat."
                    actionLabel="Create session"
                    onAction={() => router.push('/session/create')}
                  />
                ) : (
                  <View style={styles.list}>
                    {upcomingOffers.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onPress={() =>
                          router.push({ pathname: '/session/[id]', params: { id: session.id } })
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function SessionCards({
  sessions,
  onBook,
  actingId,
}: {
  sessions: Session[];
  onBook: (session: Session) => void;
  actingId: string | null;
}) {
  return (
    <View style={styles.list}>
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          ctaLabel="Book now"
          bookingAction
          actionLoading={actingId === session.id}
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
          onActionPress={() => onBook(session)}
        />
      ))}
    </View>
  );
}

function openBooking(id: string) {
  router.push({ pathname: '/booking/[id]', params: { id } });
}

function BookingList({
  title,
  bookings,
  counterpartRole,
}: {
  title: string;
  bookings: Booking[];
  counterpartRole: 'teacher' | 'learner';
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {bookings.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nothing here yet" message="Your sessions will appear here." />
      ) : (
        <View style={styles.list}>
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              counterpart={counterpartRole === 'teacher' ? booking.teacherName : booking.learnerName}
              counterpartAvatarUrl={
                counterpartRole === 'teacher' ? booking.teacherAvatarUrl : booking.learnerAvatarUrl
              }
              onPress={() => openBooking(booking.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Button label={label} variant={selected ? 'secondary' : 'ghost'} onPress={onPress} style={styles.segmentButton} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  segment: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
  },
  segmentButton: { flex: 1 },
  noticeWrap: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  searchBox: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: { ...type.body, color: colors.ink, flex: 1 },
  categoryRow: { gap: spacing.sm, paddingRight: spacing.lg },
  teachingTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.h1, color: colors.ink },
  countBadge: {
    minWidth: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countText: { ...type.caption, color: colors.inkInverse, fontWeight: '700' },
  list: { gap: spacing.md },
  requestBlock: { gap: spacing.sm },
  requestActions: { flexDirection: 'row', gap: spacing.md },
  actionHalf: { flex: 1 },
});
