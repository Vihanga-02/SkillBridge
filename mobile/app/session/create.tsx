import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LEVELS, LEVEL_LABELS, skillLabel, type Level, type SkillTag } from '@/constants/skills';
import { colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createSession, getEditableSession, updateSession } from '@/services/sessionService';
import type { SessionMode, SessionType } from '@/types';
import { errorMessage } from '@/utils/authErrors';

const TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: 'one_to_one', label: 'One-to-one' },
  { value: 'group', label: 'Group' },
];

const MODE_OPTIONS: { value: SessionMode; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In-person' },
];

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
] as const;

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CreateSessionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const editing = typeof id === 'string' && id.length > 0;

  const offeredSkills = useMemo(
    () =>
      (profile?.skillsOffered ?? []).map((skill) => ({
        value: skill.skill,
        label: skillLabel(skill.skill),
      })),
    [profile?.skillsOffered]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillTag, setSkillTag] = useState<SkillTag | null>(
    offeredSkills[0]?.value ?? null
  );
  const [level, setLevel] = useState<Level>('beginner');
  const [sessionType, setSessionType] = useState<SessionType>('group');
  const [mode, setMode] = useState<SessionMode>('online');
  const [meetingLink, setMeetingLink] = useState('');
  const [locationText, setLocationText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('10');
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(editing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skillTag && offeredSkills[0]) setSkillTag(offeredSkills[0].value);
  }, [offeredSkills, skillTag]);

  useEffect(() => {
    if (!editing || !id || !profile) return;
    let active = true;
    setLoadingSession(true);
    setError(null);
    void getEditableSession(id)
      .then((session) => {
        if (!active) return;
        if (!session) throw new Error('This session could not be found.');
        if (session.teacherId !== profile.uid) {
          throw new Error('Only the teacher who created this session can edit it.');
        }
        if ((session.bookingCount ?? 0) > 0 || session.seatsTaken > 0) {
          throw new Error('This session cannot be edited after a learner has booked it.');
        }
        const start = session.startAt.toDate();
        setTitle(session.title);
        setDescription(session.description);
        setSkillTag(session.skillTag);
        setLevel(session.level);
        setSessionType(session.type);
        setMode(session.mode);
        setMeetingLink(session.meetingLink);
        setLocationText(session.locationText);
        setDate(
          `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        );
        setTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
        setDuration(String(session.durationMins));
        setCapacity(String(session.capacity));
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingSession(false);
      });
    return () => {
      active = false;
    };
  }, [editing, id, profile]);

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  if (loadingSession) return <LoadingState fullScreen label="Loading session..." />;

  if (profile.role === 'learner') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Create session" showBack />
        <View style={styles.padded}>
          <Notice
            tone="info"
            message="Switch your role to Teach or Teach & learn in Edit profile before offering sessions."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (offeredSkills.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Create session" showBack />
        <View style={styles.padded}>
          <Notice
            tone="info"
            message="Add at least one skill you teach on your profile, then come back to schedule a session."
          />
          <Button
            label="Edit profile"
            onPress={() => router.push('/profile/edit')}
            style={styles.topGap}
          />
        </View>
      </SafeAreaView>
    );
  }

  async function onSubmit() {
    if (!profile || !skillTag) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        title,
        description,
        skillTag,
        level,
        type: sessionType,
        mode,
        meetingLink,
        locationText,
        date,
        time,
        durationMins: Number(duration),
        capacity: Number(capacity) || 1,
      };
      const sessionId = editing && id ? id : await createSession(profile, input);
      if (editing && id) await updateSession(profile, id, input);
      router.replace({ pathname: '/session/[id]', params: { id: sessionId } });
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={editing ? 'Edit session' : 'Create session'}
        subtitle={editing ? 'Update this session before anyone books it.' : 'Offer time for peers to book.'}
        showBack
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {error ? <Notice tone="error" message={error} /> : null}

          <Input
            label="Session title"
            value={title}
            onChangeText={setTitle}
            placeholder="React Native Beginner Workshop"
            autoCapitalize="sentences"
          />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What will learners cover?"
            multiline
            autoCapitalize="sentences"
          />

          <ChipSelect
            label="Skill"
            options={offeredSkills}
            value={skillTag}
            onChange={setSkillTag}
          />
          <ChipSelect
            label="Level"
            options={LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))}
            value={level}
            onChange={setLevel}
          />
          <ChipSelect
            label="Session type"
            options={TYPE_OPTIONS}
            value={sessionType}
            onChange={(value) => {
              setSessionType(value);
              if (value === 'one_to_one') setCapacity('1');
              else if (capacity === '1') setCapacity('10');
            }}
          />
          <ChipSelect label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />

          {mode === 'online' ? (
            <Input
              label="Meeting link"
              value={meetingLink}
              onChangeText={setMeetingLink}
              placeholder="https://meet.google.com/…"
              autoCapitalize="none"
              keyboardType="url"
            />
          ) : (
            <Input
              label="Location"
              value={locationText}
              onChangeText={setLocationText}
              placeholder="Library study room B"
              autoCapitalize="sentences"
            />
          )}

          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            minDate={todayIso()}
            helper="Pick a future day for the session."
          />
          <Input
            label="Start time (24h)"
            value={time}
            onChangeText={setTime}
            placeholder="18:00"
            helper="Example: 18:00 for 6.00 PM"
            autoCapitalize="none"
          />
          <ChipSelect
            label="Duration"
            options={[...DURATION_OPTIONS]}
            value={duration}
            onChange={setDuration}
          />

          {sessionType === 'group' ? (
            <Input
              label="Capacity"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
              placeholder="10"
            />
          ) : (
            <Text style={styles.helper}>One-to-one sessions always have 1 seat.</Text>
          )}

          <Button
            label={editing ? 'Save changes' : 'Publish session'}
            onPress={() => void onSubmit()}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  padded: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  topGap: {
    marginTop: spacing.md,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
