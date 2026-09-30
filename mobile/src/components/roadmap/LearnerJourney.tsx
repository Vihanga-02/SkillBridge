import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { learnerRoadmapHierarchy, roadmapProgress } from '@/utils/teacherRoadmaps';

type Summary = Pick<ReturnType<typeof roadmapProgress>, 'total' | 'completedCount' | 'completed' | 'progress'>;
type Milestone = ReturnType<typeof roadmapProgress>['items'][number];
export const milestoneAction = (item: Milestone) => item.completed ? 'Review Lesson' : item.enrollment ? 'Continue Learning' : 'View Lesson';

export function JourneyProgress({ label, summary, dark = false }: { label: string; summary: Summary; dark?: boolean }) {
  return <View style={s.progress}>
    <Text style={[s.label, dark && s.inverse]}>{label}</Text>
    <Text style={[s.percentage, dark && s.inverse]}>{summary.progress}%</Text>
    <View style={[s.track, dark && s.darkTrack]} accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: summary.progress }}>
      <View style={[s.fill, { width: `${summary.progress}%` }]} />
    </View>
    <Text style={[s.meta, dark && s.inverse]}>{summary.completedCount} of {summary.total} lessons completed</Text>
  </View>;
}

export function LearnerRoadmapHome({ goals, onOpen }: {
  goals: ReturnType<typeof learnerRoadmapHierarchy>; onOpen: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  return <View style={s.groups}>
    <Text style={s.meta}>Track your progress toward your career goals.</Text>
    {goals.length === 0 ? <View style={s.card}>
      <Ionicons name="map-outline" size={sizes.iconLg} color={colors.accent} />
      <Text style={s.title}>No learning roadmaps yet</Text>
      <Text style={s.meta}>Enroll in lessons that are part of a teacher-created roadmap to start your learning journey.</Text>
    </View> : null}
    {goals.map(goal => <View key={goal.id} style={s.groups}>
      <View style={s.goal}>
        <Ionicons name="flag-outline" size={sizes.iconLg} color={colors.inkInverse} />
        <Text style={[s.label, s.inverse]}>CAREER GOAL</Text>
        <Text style={[s.title, s.inverse]}>Career Goal: {goal.name}</Text>
        <JourneyProgress label="Career Goal Progress" summary={goal.progress} dark />
        {goal.progress.completed ? <Text style={[s.strong, s.inverse]}>✓ Career Goal Roadmaps Completed</Text> : null}
        <Text style={[s.caption, s.inverse]}>Based on your relevant teacher-created roadmap lessons.</Text>
      </View>
      {goal.skills.map(skill => <View key={skill.key} style={s.skill}>
        <Pressable style={s.skillHeader} accessibilityRole="button" accessibilityLabel={`${skill.name} roadmaps`}
          accessibilityState={{ expanded: !collapsed.has(`${goal.id}/${skill.key}`) }}
          onPress={() => setCollapsed(previous => {
            const next = new Set(previous); const key = `${goal.id}/${skill.key}`;
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          })}>
          <Ionicons name="git-branch-outline" size={sizes.iconLg} color={colors.accent} />
          <Text style={s.title}>Skill: {skill.name}</Text>
          <Ionicons name={collapsed.has(`${goal.id}/${skill.key}`) ? 'chevron-down' : 'chevron-up'} size={sizes.iconMd} color={colors.accent} />
        </Pressable>
        <JourneyProgress label="Skill Progress" summary={skill.progress} />
        {skill.progress.completed ? <Text style={s.success}>✓ Skill Completed</Text> : null}
        {!collapsed.has(`${goal.id}/${skill.key}`) && skill.journeys.map(({ roadmap, summary }, index) => <View key={roadmap.id} style={s.pathPreview}>
          <View style={s.previewRail}>
            <View style={s.previewLine} />
            <View style={s.smallNode}><Text style={s.nodeText}>{String(index + 1).padStart(2, '0')}</Text></View>
          </View>
          <View style={s.previewBody}>
            <Text style={s.label}>LEARNING PATH</Text>
            <Text style={s.title}>{roadmap.title}</Text>
            <Text style={s.meta}>By {roadmap.teacherName || 'SkillBridge teacher'}</Text>
            <JourneyProgress label="Roadmap Progress" summary={summary} />
            {summary.completed ? <Text style={s.success}>✓ Roadmap Completed</Text> : summary.next ?
              <Text style={s.meta}>Next: {summary.next.lesson?.lessonName}</Text> : null}
            <Button label="View Roadmap" variant="secondary" icon="map-outline" onPress={() => onOpen(roadmap.id)} />
          </View>
        </View>)}
      </View>)}
    </View>)}
  </View>;
}

export function VisualLessonJourney({ summary, onOpen }: {
  summary: ReturnType<typeof roadmapProgress>; onOpen: (item: Milestone) => void;
}) {
  return <View style={s.journey}>
    {summary.next ? <View style={s.continueCard}>
      <Text style={s.title}>Continue your journey</Text>
      <Text style={s.strong}>Next: {summary.next.lesson?.lessonName}</Text>
      <Button label={milestoneAction(summary.next)} onPress={() => onOpen(summary.next!)} />
    </View> : null}
    <Text style={s.bookend}>START</Text>
    {summary.items.map((item, index) => {
      const current = item.available && item.id === summary.next?.id;
      const phase = !item.available ? 'Unavailable' : item.completed ? 'Completed' : current ? 'Current / Next' : 'Upcoming';
      return <View key={item.id} style={s.stage} testID={`milestone-${item.id}`}>
        <View style={s.spine} />
        <View style={[s.node, item.completed && s.doneNode, current && s.currentNode]} accessible accessibilityLabel={`Step ${index + 1}: ${phase}`}>
          {item.completed ? <Ionicons name="checkmark" size={sizes.iconLg} color={colors.inkInverse} /> :
            <Text style={[s.nodeText, current && s.inverse]}>{String(index + 1).padStart(2, '0')}</Text>}
        </View>
        <View style={[s.milestone, index % 2 ? s.right : s.left, current && s.currentCard, !item.available && s.unavailable]}>
          <Text style={s.label}>{String(index + 1).padStart(2, '0')} · {phase}</Text>
          <Text style={s.title}>{index + 1}. {item.lesson?.lessonName ?? 'Unavailable lesson'}</Text>
          <Text style={item.completed ? s.success : s.meta}>{item.status}</Text>
          {item.available && item.enrollment && !item.completed && item.progress > 0 ?
            <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel={`${item.lesson?.lessonName} progress`}
              accessibilityValue={{ min: 0, max: 100, now: item.progress }}>
              <View style={[s.fill, { width: `${item.progress}%` }]} />
            </View> : null}
          {item.available ? <Button label={milestoneAction(item)} variant={current ? 'primary' : 'secondary'} onPress={() => onOpen(item)} /> : null}
        </View>
      </View>;
    })}
    <Ionicons name="flag" size={sizes.iconLg} color={summary.completed ? colors.accent : colors.inkMuted} style={s.finishIcon} />
    <Text style={s.bookend}>{summary.completed ? 'JOURNEY COMPLETE' : 'FINISH'}</Text>
  </View>;
}

const s = StyleSheet.create({
  groups: { gap: spacing.xl }, progress: { gap: spacing.sm },
  title: { ...type.h2, color: colors.ink, flexShrink: 1 },
  strong: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.body, color: colors.inkMuted }, label: { ...type.label, color: colors.accent },
  caption: { ...type.caption, color: colors.inkMuted }, inverse: { color: colors.inkInverse },
  percentage: { ...type.h1, color: colors.ink }, success: { ...type.bodyStrong, color: colors.accent },
  track: { height: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.full, overflow: 'hidden' },
  darkTrack: { backgroundColor: colors.inkMuted }, fill: { height: '100%', backgroundColor: colors.accent },
  goal: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md },
  skill: { gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  skillHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: sizes.touchMin },
  pathPreview: { flexDirection: 'row', gap: spacing.sm },
  previewRail: { width: sizes.avatarSm, alignItems: 'center' },
  previewLine: { position: 'absolute', top: 0, bottom: 0, width: spacing.xs, backgroundColor: colors.accentSurface },
  smallNode: { width: sizes.avatarSm, height: sizes.avatarSm, borderRadius: radius.full, backgroundColor: colors.accentSurface, alignItems: 'center', justifyContent: 'center' },
  previewBody: { flex: 1, gap: spacing.md, paddingBottom: spacing.lg },
  journey: { gap: 0 }, continueCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.accentSurface, gap: spacing.md, marginBottom: spacing.xl },
  bookend: { ...type.label, color: colors.accent, textAlign: 'center', paddingVertical: spacing.md },
  stage: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  spine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: spacing.xs, marginLeft: -spacing.xs / 2, backgroundColor: colors.border },
  node: { alignSelf: 'center', width: sizes.control, minHeight: sizes.control, borderRadius: radius.full, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: spacing.xs / 2, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  nodeText: { ...type.bodyStrong, color: colors.accent },
  doneNode: { backgroundColor: colors.accent, borderColor: colors.accent },
  currentNode: { backgroundColor: colors.ink, borderColor: colors.accent },
  milestone: { width: '92%', padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  left: { alignSelf: 'flex-start' }, right: { alignSelf: 'flex-end' },
  currentCard: { borderColor: colors.accent, borderWidth: spacing.xs / 2, backgroundColor: colors.accentSurface },
  unavailable: { backgroundColor: colors.surfaceAlt }, finishIcon: { alignSelf: 'center' },
});
