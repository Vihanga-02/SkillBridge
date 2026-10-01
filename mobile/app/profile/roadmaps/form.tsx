import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { roadmapStyles as styles } from '@/components/roadmap/RoadmapSummary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CAREER_GOALS, type CareerGoalTag } from '@/constants/careerGoals';
import { useAuth } from '@/hooks/useAuth';
import { listLessonsByTeacher } from '@/services/lessonService';
import { getTeacherRoadmap, saveTeacherRoadmap } from '@/services/teacherRoadmapService';
import type { Lesson } from '@/types';
import { canManageRoadmaps, isEligibleRoadmapLesson, moveRoadmapLesson } from '@/utils/teacherRoadmaps';
import { errorMessage } from '@/utils/authErrors';

export default function RoadmapFormScreen() {
  const { roadmapId } = useLocalSearchParams<{ roadmapId?: string }>();
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [careerGoalId, setGoal] = useState<CareerGoalTag | null>(null);
  const [skill, setSkill] = useState('');
  const [description, setDescription] = useState('');
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    setReady(false); setLoading(true); setError(null);
    if (!profile) return;
    if (!canManageRoadmaps(profile.role)) { setLoading(false); return; }
    (async () => {
      try {
        const [owned, roadmap] = await Promise.all([
          listLessonsByTeacher(profile.uid), roadmapId ? getTeacherRoadmap(roadmapId) : Promise.resolve(null),
        ]);
        if (!active) return;
        if (roadmapId && !roadmap) throw new Error('This roadmap no longer exists.');
        if (roadmap && roadmap.teacherId !== profile.uid) throw new Error('Only the roadmap creator can edit it.');
        setLessons(owned);
        setTitle(roadmap?.title ?? ''); setGoal(roadmap?.careerGoalId ?? null);
        setSkill(roadmap?.skill ?? ''); setDescription(roadmap?.description ?? '');
        setLessonIds(roadmap?.lessonIds ?? []); setRevision(roadmap?.revision ?? 0);
        setReady(true);
      } catch (e) { if (active) setError(errorMessage(e)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [profile, roadmapId, reload]);

  const eligible = lessons.filter(lesson => profile && isEligibleRoadmapLesson(lesson, profile.uid, careerGoalId));
  const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const eligibleIds = new Set(eligible.map(lesson => lesson.id));
  const invalid = lessonIds.some(id => !eligibleIds.has(id));
  function changeGoal(goal: CareerGoalTag) {
    if (saving) return;
    const next = lessonIds.filter(id => {
      const lesson = byId.get(id);
      return lesson && profile && isEligibleRoadmapLesson(lesson, profile.uid, goal);
    });
    setNotice(next.length !== lessonIds.length ? 'Lessons that do not match the new career goal were removed.' : null);
    setGoal(goal); setLessonIds(next);
  }
  async function save() {
    if (!profile || !ready || pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      await saveTeacherRoadmap(profile, { title, careerGoalId, skill, description, lessonIds }, roadmapId, revision);
      router.replace({ pathname: '/profile/roadmaps', params: { mode: 'teach' } } as Href);
    } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setSaving(false); }
  }

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={roadmapId ? 'Edit Learning Roadmap' : 'Create Learning Roadmap'} showBack />
        {loading ? <LoadingState label="Loading your lessons..." /> : null}
        {profile && !canManageRoadmaps(profile.role) ? <Notice tone="info" message="Only Teacher and Both users can create learning roadmaps." /> : null}
        {error ? <Notice tone="error" message={error} /> : null}
        {!loading && !ready && profile && canManageRoadmaps(profile.role) ? <Button label="Retry" onPress={() => setReload(value => value + 1)} /> : null}
        {ready ? <>
          <Input label="Roadmap title" placeholder="JavaScript Learning Roadmap" value={title} onChangeText={setTitle} maxLength={120} editable={!saving} />
          <ChipSelect label="Career Goal" options={CAREER_GOALS.map(goal => ({ value: goal.tag, label: goal.label }))} value={careerGoalId} onChange={changeGoal} />
          <Input label="Skill" placeholder="JavaScript" value={skill} onChangeText={setSkill} maxLength={80} editable={!saving} />
          <Input label="Description (optional)" placeholder="What will learners achieve?" value={description} onChangeText={setDescription} multiline maxLength={1000} editable={!saving} />
          {notice ? <Notice tone="info" message={notice} /> : null}
          {invalid ? <Notice tone="error" message="Some selected lessons are unavailable or no longer match this career goal. Remove them before saving." /> : null}
          <Text style={styles.title}>Lesson order ({lessonIds.length})</Text>
          {lessonIds.map((id, index) => <Card key={id}><View style={styles.section}>
            <Text style={styles.heading}>{index + 1}. {byId.get(id)?.lessonName ?? 'Unavailable lesson'}</Text>
            {!eligibleIds.has(id) ? <Text style={styles.meta}>Remove this lesson before saving.</Text> : null}
            <Button label={`Move Lesson ${index + 1} Up`} variant="secondary" disabled={saving || index === 0}
              onPress={() => setLessonIds(ids => moveRoadmapLesson(ids, index, -1))} />
            <Button label={`Move Lesson ${index + 1} Down`} variant="secondary" disabled={saving || index === lessonIds.length - 1}
              onPress={() => setLessonIds(ids => moveRoadmapLesson(ids, index, 1))} />
            <Button label={`Remove Lesson ${index + 1}`} variant="ghost" disabled={saving} onPress={() => setLessonIds(ids => ids.filter(value => value !== id))} />
          </View></Card>)}
          <Text style={styles.title}>Add Lessons</Text>
          {!careerGoalId || !skill.trim() ? <Notice tone="info" message="Choose a career goal and enter a skill to select your lessons." /> : <>
            {eligible.length === 0 ? <Notice tone="info" message="You have no available lessons for this career goal. Create a matching lesson in My Lessons first." /> : null}
            {eligible.map(lesson => <Button key={lesson.id} label={`${lessonIds.includes(lesson.id) ? 'Selected: ' : 'Add: '}${lesson.lessonName}`}
              variant="secondary" disabled={saving || lessonIds.includes(lesson.id)}
              onPress={() => setLessonIds(ids => ids.includes(lesson.id) ? ids : [...ids, lesson.id])} />)}
          </>}
          <Button label="Save Roadmap" loading={saving} disabled={invalid} onPress={() => void save()} />
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
