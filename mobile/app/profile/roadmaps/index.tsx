import { LearnerRoadmapHome } from '@/components/roadmap/LearnerJourney';
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
import { loadRoadmaps, type RoadmapData } from '@/services/teacherRoadmapService';
import { canManageRoadmaps, roadmapProgress, learnerRoadmapHierarchy } from '@/utils/teacherRoadmaps';
import { errorMessage } from '@/utils/authErrors';

export default function RoadmapsScreen() {
  const { profile } = useAuth();
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const mode = requestedMode === 'teach' ? 'teach' : 'learn';
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setError(null); setLoading(true);
    if (!profile) return;
    loadRoadmaps(profile, mode).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Retry deliberately recreates the focus callback even when the account and mode are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, mode, reload]));
  const lessons = new Map(data?.lessons.map(row => [row.id, row]));
  const enrollments = new Map(data?.enrollments.map(row => [row.lessonId, row]));
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title={mode === 'teach' ? 'Learning Roadmaps' : 'My Learning Roadmaps'} showBack />
      {mode === 'teach' && profile && canManageRoadmaps(profile.role) ? <Button label="+ Create Roadmap"
        onPress={() => router.push('/profile/roadmaps/form' as Href)} /> : null}
      {loading ? <LoadingState label="Loading roadmaps..." /> : null}
      {error ? <><Notice tone="error" message={error} /><Button label="Retry" variant="secondary" onPress={() => setReload(value => value + 1)} /></> : null}
      {mode === 'teach' && data?.roadmaps.length === 0 ? <Notice tone="info" message={mode === 'teach'
        ? 'Create a learning roadmap using your lessons.'
        : 'Roadmaps appear here when they contain a lesson you are enrolled in.'} /> : null}
      {mode === 'learn' && data ? <LearnerRoadmapHome goals={learnerRoadmapHierarchy(data.roadmaps, lessons, enrollments)}
        onOpen={id => router.push({ pathname: '/profile/roadmaps/[id]', params: { id, mode: 'learn' } } as Href)} /> : null}
      {mode === 'teach' && data?.roadmaps.map(roadmap => {
        const summary = roadmapProgress(roadmap, lessons, enrollments);
        return <Card key={roadmap.id}><View style={styles.section}>
          <RoadmapSummary roadmap={roadmap} summary={summary} learning={false} />
          {mode === 'teach' ? <>
            {summary.items.map((item, index) => <Text key={item.id} style={styles.meta}>
              {index + 1}. {item.lesson?.lessonName ?? 'Unavailable lesson'}
            </Text>)}
            <Button label="Edit Roadmap" variant="secondary" onPress={() => router.push({ pathname: '/profile/roadmaps/form', params: { roadmapId: roadmap.id } } as Href)} />
          </> : null}
          <Button label="View Roadmap" onPress={() => router.push({ pathname: '/profile/roadmaps/[id]', params: { id: roadmap.id, mode } } as Href)} />
        </View></Card>;
      })}
    </ScrollView>
  </SafeAreaView>;
}
