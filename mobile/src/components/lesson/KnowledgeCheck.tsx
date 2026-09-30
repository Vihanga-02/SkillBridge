import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { colors, spacing, type } from '@/constants/theme';
import type { Lesson, LessonEnrollment } from '@/types';
import { lessonCompletion, questionId } from '@/utils/lessonProgress';

export function KnowledgeCheck({ lesson, enrollment, onSubmit, busy }: {
  lesson: Lesson; enrollment: LessonEnrollment;
  onSubmit: (id: string, selected: number) => Promise<void>; busy: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const result = lessonCompletion(lesson, enrollment);
  if (!lesson.quiz?.length) return null;
  return <View style={styles.section}>
    <Text style={styles.heading}>Knowledge Check</Text>
    {lesson.quiz.map((q, index) => {
      const id = questionId(q, index);
      const answer = enrollment.quizAnswers?.[id];
      return <Card key={id}><View style={styles.section}>
        <Text style={styles.text}>Question {index + 1} of {lesson.quiz.length}</Text>
        <Text style={styles.heading}>{answer?.question ?? q.q}</Text>
        {answer?.submitted ? <>
          <Notice tone={answer.correct ? 'success' : 'info'} message={answer.correct ? 'Correct!' : 'Incorrect'} />
          <Text style={styles.text}>Your answer: {answer.options[answer.selectedIndex]}</Text>
          <Text style={styles.text}>Correct answer: {answer.options[answer.answerIndex]}</Text>
        </> : <>
          {q.options.map((option, optionIndex) => <Button key={optionIndex} label={option} variant="secondary"
            disabled={busy} icon={selected[id] === optionIndex ? 'radio-button-on' : 'radio-button-off'}
            onPress={() => setSelected(current => ({ ...current, [id]: optionIndex }))} />)}
          <Button label="Submit Answer" disabled={busy || selected[id] === undefined}
            onPress={() => void onSubmit(id, selected[id])} />
        </>}
      </View></Card>;
    })}
    {result.submitted === lesson.quiz.length ? <Notice tone="success"
      message={`Knowledge Check Complete. Score: ${result.correct} / ${lesson.quiz.length} (${result.quizScore}%)`} /> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: spacing.md }, heading: { ...type.bodyStrong, color: colors.ink }, text: { ...type.body, color: colors.inkMuted } });
