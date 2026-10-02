import { VisualLessonJourney } from '@/components/roadmap/LearnerJourney';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoadmapSummary, roadmapStyles as styles } from '@/components/roadmap/RoadmapSummary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/hooks/useAuth';
import { loadRoadmapDetail, type RoadmapData } from '@/services/teacherRoadmapService';
import { enrollInLesson, getEnrollment } from '@/services/lessonService';
import { canLearnRoadmaps, roadmapProgress } from '@/utils/teacherRoadmaps';
import { errorMessage } from '@/utils/authErrors';

export default function RoadmapDetailScreen() {
  const { id, mode: requestedMode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const mode = requestedMode === 'teach' ? 'teach' : 'learn';
  const { profile } = useAuth();
  const [data, setData] = useState<RoadmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const pending = useRef(new Set<string>());
  const focusVersion = useRef(0);
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());
  useFocusEffect(useCallback(() => {
    let active = true;
    focusVersion.current += 1;
    pending.current = new Set(); setEnrollingIds(new Set());
    setData(null); setError(null); setLoading(true);
    if (!profile || !id) return;
    loadRoadmapDetail(profile, id, mode).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; focusVersion.current += 1; };
    // Retry deliberately recreates the focus callback without requiring navigation away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, profile, reload]));
  const roadmap = data?.roadmaps[0];
  const summary = roadmap && data ? roadmapProgress(roadmap,
    new Map(data.lessons.map(row => [row.id, row])), new Map(data.enrollments.map(row => [row.lessonId, row]))) : null;
  async function openMilestone(item: NonNullable<typeof summary>['items'][number]) {
    if (!profile || mode !== 'learn' || !canLearnRoadmaps(profile.role) || !item.available) return;
    if (item.enrollment) {
      router.push({ pathname: '/lesson/[id]', params: { id: item.id } });
      return;
    }
    if (!item.lesson || pending.current.has(item.id)) return;
    const version = focusVersion.current;
    pending.current.add(item.id);
    setEnrollingIds(new Set(pending.current)); setError(null);
    try {
      await enrollInLesson(profile, item.lesson);
      const enrollment = await getEnrollment(profile.uid, item.id);
      if (!enrollment) throw new Error('Could not refresh enrollment. Please retry.');
      if (version === focusVersion.current) setData(current => current ? {
        ...current, enrollments: [...current.enrollments.filter(row => row.lessonId !== item.id), enrollment],
      } : current);
    } catch (e) {
      if (version === focusVersion.current) setError(errorMessage(e));
    } finally {
      if (version === focusVersion.current) {
        pending.current.delete(item.id); setEnrollingIds(new Set(pending.current));
      }
    }
  }
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Learning Roadmap" showBack />
      {loading ? <LoadingState label="Loading roadmap..." /> : null}
      {error ? <><Notice tone="error" message={error} /><Button label="Retry" variant="secondary" onPress={() => setReload(value => value + 1)} /></> : null}
      {roadmap && summary ? <>
        <Card><RoadmapSummary roadmap={roadmap} summary={summary} learning={mode === 'learn'} /></Card>
        {roadmap.description ? <Text style={styles.meta}>{roadmap.description}</Text> : null}
        {mode === 'teach' ? <Button label="Edit Roadmap" onPress={() => router.push({ pathname: '/profile/roadmaps/form', params: { roadmapId: roadmap.id } } as Href)} /> : null}
        {mode === 'learn' ? <VisualLessonJourney summary={summary} enrollingIds={enrollingIds} onOpen={item => { void openMilestone(item); }} /> : null}
        {mode === 'teach' && summary.items.map((item, index) => <Card key={item.id}><View style={styles.section}>
          <Text style={styles.heading}>{index + 1}. {item.lesson?.lessonName ?? 'Unavailable lesson'}</Text>
          {!item.available ? <Text style={styles.meta}>{item.status}</Text> : null}
          {item.available ? <Button label="View Lesson"
            variant="secondary" onPress={() => router.push({
              pathname: '/lesson/[id]', params: { id: item.id },
            })} /> : null}
        </View></Card>)}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}
