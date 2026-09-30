import { VisualLessonJourney } from '@/components/roadmap/LearnerJourney';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { roadmapProgress } from '@/utils/teacherRoadmaps';
import { errorMessage } from '@/utils/authErrors';

export default function RoadmapDetailScreen() {
  const { id, mode: requestedMode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const mode = requestedMode === 'teach' ? 'teach' : 'learn';
  const { profile } = useAuth();
  const [data, setData] = useState<RoadmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setError(null); setLoading(true);
    if (!profile || !id) return;
    loadRoadmapDetail(profile, id, mode).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Retry deliberately recreates the focus callback without requiring navigation away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, profile, reload]));
  const roadmap = data?.roadmaps[0];
  const summary = roadmap && data ? roadmapProgress(roadmap,
    new Map(data.lessons.map(row => [row.id, row])), new Map(data.enrollments.map(row => [row.lessonId, row]))) : null;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Learning Roadmap" showBack />
      {loading ? <LoadingState label="Loading roadmap..." /> : null}
      {error ? <><Notice tone="error" message={error} /><Button label="Retry" variant="secondary" onPress={() => setReload(value => value + 1)} /></> : null}
      {roadmap && summary ? <>
        <Card><RoadmapSummary roadmap={roadmap} summary={summary} learning={mode === 'learn'} /></Card>
        {roadmap.description ? <Text style={styles.meta}>{roadmap.description}</Text> : null}
        {mode === 'teach' ? <Button label="Edit Roadmap" onPress={() => router.push({ pathname: '/profile/roadmaps/form', params: { roadmapId: roadmap.id } } as Href)} /> : null}
        {mode === 'learn' ? <VisualLessonJourney summary={summary} onOpen={item => router.push({
          pathname: item.enrollment ? '/lesson/[id]' : '/lesson/details/[id]', params: { id: item.id },
        })} /> : null}
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
