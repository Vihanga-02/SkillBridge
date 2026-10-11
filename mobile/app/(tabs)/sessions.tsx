import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, formatDistanceToNowStrict, isSameDay, startOfDay } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookingCard } from '@/components/session/BookingCard';
import { SessionCard } from '@/components/session/SessionCard';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { CATEGORY_STYLE } from '@/constants/categoryStyle';
import { CATEGORIES, skillLabel, type Category } from '@/constants/skills';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  approveBooking,
  declineBooking,
  requestBooking,
  subscribeToMyBookings,
} from '@/services/bookingService';
import { deleteSession, getSessionsByTeacher, listUpcomingSessions } from '@/services/sessionService';
import type { Booking, Session } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { SESSION_MODE_LABEL, formatSessionTime } from '@/utils/sessionFormat';

type SessionsView = 'browse' | 'bookings' | 'teaching';
type BrowseScope = 'all' | 'forYou';
type BookingFilter = 'upcoming' | 'past' | 'cancelled';
type TeachingView = 'requests' | 'sessions' | 'schedule' | 'history';
type BrowseDateFilter = 'all' | 'today' | 'custom';

export default function SessionsScreen() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const teacherOnly = profile?.role === 'teacher';
  const dualRole = profile?.role === 'both';
  const canTeach = teacherOnly || dualRole;

  const [view, setView] = useState<SessionsView>('browse');
  const [teachingViewTab, setTeachingViewTab] = useState<TeachingView>('requests');
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('upcoming');
  const [browseScope, setBrowseScope] = useState<BrowseScope>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [dateFilter, setDateFilter] = useState<BrowseDateFilter>('all');
  const [customDate, setCustomDate] = useState(() => startOfDay(new Date()));
  const [iosDatePickerOpen, setIosDatePickerOpen] = useState(false);
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
  const activeBookingBySession = useMemo(
    () =>
      new Map(
        learnerBookings
          .filter((booking) => ['pending', 'confirmed', 'completed'].includes(booking.status))
          .map((booking) => [booking.sessionId, booking])
      ),
    [learnerBookings]
  );
  const upcomingBookings = learnerBookings.filter((booking) =>
    ['pending', 'confirmed'].includes(booking.status)
  );
  /** The learner's soonest confirmed session that has not started yet. */
  const nextUp = useMemo(() => {
    const now = Date.now();
    return (
      learnerBookings
        .filter(
          (booking) =>
            booking.status === 'confirmed' && (booking.startAt?.toMillis?.() ?? 0) > now
        )
        .sort((a, b) => (a.startAt?.toMillis?.() ?? 0) - (b.startAt?.toMillis?.() ?? 0))[0] ?? null
    );
  }, [learnerBookings]);
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
  const teachingHistory = teachingBookings.filter((booking) =>
    ['completed', 'declined', 'cancelled'].includes(booking.status)
  );
  const upcomingOffers = myOffers.filter(
    (session) =>
      ['open', 'full'].includes(session.status) &&
      (session.startAt?.toMillis?.() ?? 0) > Date.now()
  );
  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const wantedSkills = new Set(profile?.skillTagsWanted ?? []);
    const selectedDate =
      dateFilter === 'today'
        ? startOfDay(new Date())
        : dateFilter === 'custom'
          ? customDate
          : null;

    return sessions.filter((session) => {
      const searchable = `${session.title} ${session.teacherName} ${skillLabel(session.skillTag)}`.toLowerCase();
      const startDate = session.startAt?.toDate?.();
      return (
        (browseScope === 'all' || wantedSkills.has(session.skillTag)) &&
        (!category || session.category === category) &&
        (!term || searchable.includes(term)) &&
        (!selectedDate || (!!startDate && isSameDay(startDate, selectedDate)))
      );
    });
  }, [browseScope, category, customDate, dateFilter, profile?.skillTagsWanted, search, sessions]);

  function onCustomDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      setCustomDate(startOfDay(selected));
      setDateFilter('custom');
    }
  }

  function openCustomDatePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: customDate,
        minimumDate: startOfDay(new Date()),
        mode: 'date',
        onChange: onCustomDateChange,
      });
      return;
    }
    setIosDatePickerOpen(true);
  }

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

  function confirmDeleteSession(session: Session) {
    if (!profile) return;
    Alert.alert(
      'Delete session?',
      `Delete "${session.title}" permanently? This cannot be undone.`,
      [
        { text: 'Keep session', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActingId(session.id);
            setSessionsError(null);
            try {
              await deleteSession(session.id, profile.uid);
              await loadSessions();
            } catch (actionError) {
              Alert.alert('Could not delete session', errorMessage(actionError));
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
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
    <View style={styles.safe}>
      <BrandHeader
        title={teacherOnly ? 'Teacher Sessions' : 'Sessions'}
        subtitle={
          teacherOnly
            ? 'Create sessions and manage learner requests.'
            : 'Learn something new or share your skills.'
        }
        action={
          canTeach ? (
            <Pressable
              onPress={() => router.push('/session/create')}
              accessibilityRole="button"
              accessibilityLabel="Create a session"
              style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}>
              <Ionicons name="add" size={sizes.iconMd} color={colors.ink} />
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          ) : undefined
        }>
        {!teacherOnly ? (
          <SegmentedTabs
            tone="dark"
            accessibilityLabel="Sessions views"
            value={view}
            onChange={setView}
            options={[
              { value: 'browse', label: 'Browse' },
              { value: 'bookings', label: 'My Sessions', badge: upcomingBookings.length },
              ...(dualRole
                ? [{ value: 'teaching' as const, label: 'Teaching', badge: pendingRequests.length }]
                : []),
            ]}
          />
        ) : null}
      </BrandHeader>

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
          {nextUp ? <NextUpCard booking={nextUp} onPress={() => openBooking(nextUp.id)} /> : null}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={sizes.iconMd} color={colors.inkMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search sessions"
                placeholderTextColor={colors.inkFaint}
                style={styles.searchInput}
                accessibilityLabel="Search sessions"
              />
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Show sessions for you"
              accessibilityState={{ checked: browseScope === 'forYou' }}
              onPress={() => setBrowseScope((current) => current === 'all' ? 'forYou' : 'all')}
              style={({ pressed }) => [
                styles.forYouButton,
                browseScope === 'forYou' && styles.forYouButtonSelected,
                pressed && styles.forYouButtonPressed,
              ]}>
              <Ionicons
                name="sparkles-outline"
                size={sizes.iconSm}
                color={browseScope === 'forYou' ? colors.accent : colors.inkMuted}
              />
              <Text
                style={[
                  styles.forYouButtonText,
                  browseScope === 'forYou' && styles.forYouButtonTextSelected,
                ]}>
                For You
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            <Chip label="All" icon="apps" selected={!category} onPress={() => setCategory(null)} />
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={item}
                icon={CATEGORY_STYLE[item].icon}
                iconColor={CATEGORY_STYLE[item].color}
                selected={category === item}
                onPress={() => setCategory(item)}
                showCheck={false}
              />
            ))}
          </ScrollView>
          <View style={styles.dateFilterSection}>
            <Text style={styles.filterLabel}>Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}>
              <Chip
                size="sm"
                label="All dates"
                selected={dateFilter === 'all'}
                onPress={() => setDateFilter('all')}
              />
              <Chip
                size="sm"
                label="Today"
                selected={dateFilter === 'today'}
                onPress={() => setDateFilter('today')}
              />
              <Chip
                size="sm"
                label={dateFilter === 'custom' ? format(customDate, 'd MMM') : 'Pick date'}
                selected={dateFilter === 'custom'}
                onPress={openCustomDatePicker}
              />
            </ScrollView>
          </View>
          {visibleSessions.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title={browseScope === 'forYou' ? 'No sessions for you yet' : 'No sessions found'}
              message={
                browseScope === 'forYou'
                  ? (profile.skillTagsWanted ?? []).length === 0
                    ? 'Choose skills in your learning goals to get personalized sessions.'
                    : 'No sessions currently match your selected skills. Try browsing all sessions.'
                  : 'Try another search, category or date.'
              }
              actionLabel={browseScope === 'forYou' ? 'Browse all sessions' : undefined}
              onAction={browseScope === 'forYou' ? () => setBrowseScope('all') : undefined}
            />
          ) : (
            <SessionCards
              sessions={visibleSessions}
              bookingBySessionId={activeBookingBySession}
              onBook={confirmQuickBooking}
              actingId={actingId}
            />
          )}
        </ScrollView>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosDatePickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIosDatePickerOpen(false)}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIosDatePickerOpen(false)}
            accessibilityLabel="Close date picker"
          />
          <View style={styles.datePickerSheet}>
            <Text style={styles.datePickerTitle}>Choose a session date</Text>
            <DateTimePicker
              value={customDate}
              minimumDate={startOfDay(new Date())}
              mode="date"
              display="inline"
              onChange={onCustomDateChange}
            />
            <Button label="Done" onPress={() => setIosDatePickerOpen(false)} />
          </View>
        </Modal>
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
          <View style={styles.summaryRow}>
            <SummaryTile
              icon="mail-unread-outline"
              color={colors.danger}
              surface={colors.surfaceAlt}
              value={pendingRequests.length}
              label="Pending requests"
            />
            <SummaryTile
              icon="calendar-outline"
              color={brand.blue}
              surface={brand.blueSurface}
              value={upcomingOffers.length}
              label="Hosting soon"
            />
            <SummaryTile
              icon="checkmark-done-outline"
              color={brand.green}
              surface={brand.greenSurface}
              value={scheduledTeaching.length}
              label="Confirmed"
            />
          </View>
          <View style={styles.teachingTabs}>
            <TeachingTab
              label="Requests"
              icon="file-tray-full-outline"
              badge={pendingRequests.length}
              selected={teachingViewTab === 'requests'}
              onPress={() => setTeachingViewTab('requests')}
            />
            <TeachingTab
              label="Hosted"
              icon="calendar-outline"
              selected={teachingViewTab === 'sessions'}
              onPress={() => setTeachingViewTab('sessions')}
            />
            <TeachingTab
              label="Schedule"
              icon="calendar-clear-outline"
              selected={teachingViewTab === 'schedule'}
              onPress={() => setTeachingViewTab('schedule')}
            />
            <TeachingTab
              label="History"
              icon="time-outline"
              selected={teachingViewTab === 'history'}
              onPress={() => setTeachingViewTab('history')}
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
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      counterpart={booking.learnerName}
                      counterpartAvatarUrl={booking.learnerAvatarUrl}
                      onPress={() => openBooking(booking.id)}
                      onAccept={() => void onApprove(booking)}
                      onDecline={() => void onDecline(booking)}
                      actionLoading={actingId === booking.id}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : teachingViewTab === 'sessions' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sessions I Host</Text>
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
                    {upcomingOffers.map((session) => {
                      const hasBooking =
                        (session.bookingCount ?? 0) > 0 ||
                        session.seatsTaken > 0 ||
                        teachingBookings.some((booking) => booking.sessionId === session.id);
                      return (
                        <View key={session.id} style={styles.offerBlock}>
                          <SessionCard
                            session={session}
                            onPress={() =>
                              router.push({ pathname: '/session/[id]', params: { id: session.id } })
                            }
                          />
                          {hasBooking ? (
                            <Notice
                              tone="info"
                              message="Editing and deletion are locked because a learner has booked this session."
                            />
                          ) : (
                            <View style={styles.offerActions}>
                              <Button
                                label="Edit"
                                variant="secondary"
                                icon="create-outline"
                                disabled={actingId === session.id}
                                onPress={() =>
                                  router.push({
                                    pathname: '/session/create',
                                    params: { id: session.id },
                                  })
                                }
                                style={styles.actionHalf}
                              />
                              <Button
                                label="Delete"
                                variant="danger"
                                icon="trash-outline"
                                loading={actingId === session.id}
                                onPress={() => confirmDeleteSession(session)}
                                style={styles.actionHalf}
                              />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
          ) : teachingViewTab === 'schedule' ? (
            <BookingList
              title="Upcoming Teaching Schedule"
              bookings={scheduledTeaching}
              counterpartRole="learner"
            />
          ) : (
            <BookingList
              title="Teaching History"
              bookings={teachingHistory}
              counterpartRole="learner"
            />
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

function SessionCards({
  sessions,
  bookingBySessionId,
  onBook,
  actingId,
}: {
  sessions: Session[];
  bookingBySessionId: ReadonlyMap<string, Booking>;
  onBook: (session: Session) => void;
  actingId: string | null;
}) {
  return (
    <View style={styles.list}>
      {sessions.map((session) => {
        const booking = bookingBySessionId.get(session.id);
        const ctaLabel =
          booking?.status === 'pending'
            ? 'Request sent'
            : booking?.status === 'confirmed'
              ? 'Booked'
              : booking?.status === 'completed'
                ? 'Completed'
                : 'Book now';

        return (
          <SessionCard
            key={session.id}
            session={session}
            ctaLabel={ctaLabel}
            bookingAction
            actionLoading={actingId === session.id}
            actionDisabled={!!booking}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
            onActionPress={() => onBook(session)}
          />
        );
      })}
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

/** The learner's soonest confirmed session, pinned above Browse so it is never missed. */
function NextUpCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const start = booking.startAt?.toDate?.();
  const when = start ? formatDistanceToNowStrict(start, { addSuffix: true }) : 'soon';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Next up: ${booking.sessionTitle}, starts ${when}`}
      style={({ pressed }) => [styles.nextUp, pressed && styles.nextUpPressed]}>
      <View style={styles.nextUpIcon}>
        <Ionicons name="flash" size={sizes.iconMd} color={colors.inkInverse} />
      </View>
      <View style={styles.nextUpText}>
        <Text style={styles.nextUpEyebrow}>NEXT UP · STARTS {when.toUpperCase()}</Text>
        <Text style={styles.nextUpTitle} numberOfLines={1}>
          {booking.sessionTitle}
        </Text>
        <Text style={styles.nextUpMeta} numberOfLines={1}>
          with {booking.teacherName} · {formatSessionTime(booking.startAt)} ·{' '}
          {SESSION_MODE_LABEL[booking.mode]}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.accent} />
    </Pressable>
  );
}

function SummaryTile({
  icon,
  color,
  surface,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  surface: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.summaryTile} accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.summaryIcon, { backgroundColor: surface }]}>
        <Ionicons name={icon} size={sizes.iconMd} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TeachingTab({
  label,
  icon,
  selected,
  badge = 0,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.teachingTab,
        selected && styles.teachingTabSelected,
        pressed && styles.teachingTabPressed,
      ]}>
      <View style={styles.teachingTabIconWrap}>
        <Ionicons
          name={icon}
          size={sizes.iconMd}
          color={selected ? colors.accent : colors.inkMuted}
        />
        {badge > 0 ? (
          <View style={styles.teachingTabBadge}>
            <Text style={styles.teachingTabBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.teachingTabLabel, selected && styles.teachingTabLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touchMin - spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  createButtonPressed: { backgroundColor: colors.surfaceAlt },
  createButtonText: { ...type.label, fontWeight: '700', color: colors.ink },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.accent,
  },
  nextUpPressed: { opacity: 0.85 },
  nextUpIcon: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextUpText: { flex: 1, gap: 2 },
  nextUpEyebrow: { ...type.caption, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 },
  nextUpTitle: { ...type.bodyStrong, color: colors.ink },
  nextUpMeta: { ...type.caption, color: colors.inkMuted },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  summaryIcon: {
    width: sizes.touchMin - spacing.sm,
    height: sizes.touchMin - spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { ...type.h1, color: colors.ink },
  summaryLabel: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  forYouButton: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  forYouButtonSelected: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  forYouButtonPressed: { opacity: 0.75 },
  forYouButtonText: { ...type.caption, color: colors.inkMuted, fontWeight: '600' },
  forYouButtonTextSelected: { color: colors.accent },
  noticeWrap: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  searchBox: {
    flex: 1,
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
  dateFilterSection: { gap: spacing.sm },
  filterLabel: { ...type.label, color: colors.ink },
  modalBackdrop: { flex: 1, backgroundColor: colors.ink, opacity: 0.4 },
  datePickerSheet: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  datePickerTitle: { ...type.h2, color: colors.ink },
  teachingTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
  },
  teachingTab: {
    flex: 1,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  teachingTabSelected: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  teachingTabPressed: { opacity: 0.75 },
  teachingTabIconWrap: { position: 'relative' },
  teachingTabLabel: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  teachingTabLabelSelected: { color: colors.accent, fontWeight: '700' },
  teachingTabBadge: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.md,
    minWidth: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  teachingTabBadgeText: { ...type.caption, color: colors.inkInverse, fontWeight: '700' },
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
  offerBlock: { gap: spacing.sm },
  offerActions: { flexDirection: 'row', gap: spacing.md },
  actionHalf: { flex: 1 },
});
