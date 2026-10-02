import { StyleSheet, Text, View } from 'react-native';
import { careerGoalByTag } from '@/constants/careerGoals';
import { colors, spacing, type } from '@/constants/theme';
import { JourneyProgress } from '@/components/roadmap/LearnerJourney';
import type { TeacherRoadmap } from '@/types';
import type { roadmapProgress } from '@/utils/teacherRoadmaps';

export function RoadmapSummary({ roadmap, summary, learning }: {
  roadmap: TeacherRoadmap; summary: ReturnType<typeof roadmapProgress>; learning: boolean;
}) {
  return <View style={roadmapStyles.section}>
    {learning ? <Text style={roadmapStyles.title}>{roadmap.title}</Text> : null}
    <Text style={roadmapStyles.meta}>Career Goal: {careerGoalByTag(roadmap.careerGoalId)?.label ?? roadmap.careerGoalId}</Text>
    <Text style={roadmapStyles.heading}>Skill: {roadmap.skill}</Text>
    {!learning ? <Text style={roadmapStyles.title}>{roadmap.title}</Text> : null}
    <Text style={roadmapStyles.meta}>By {roadmap.teacherName || 'SkillBridge teacher'}</Text>
    <Text style={roadmapStyles.meta}>{summary.total} {summary.total === 1 ? 'lesson' : 'lessons'}</Text>
    {learning ? <>
      <JourneyProgress label="Roadmap Progress" summary={summary} />

      {summary.completed ? <Text style={roadmapStyles.heading}>✓ Roadmap Completed</Text> : null}
    </> : null}
    {summary.unavailableCount ? <Text style={roadmapStyles.meta}>
      {summary.unavailableCount} unavailable {summary.unavailableCount === 1 ? 'lesson is' : 'lessons are'} excluded from progress.
    </Text> : null}
  </View>;
}
export const roadmapStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...type.h2, color: colors.ink },
  heading: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.body, color: colors.inkMuted },
});
