import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { colors, spacing, type } from '@/constants/theme';
import type { QuizQuestion } from '@/types';
import { questionId, validateQuiz } from '@/utils/lessonProgress';

export function KnowledgeCheckEditor({ questions, onChange, onEditing, disabled }: {
  questions: QuizQuestion[]; onChange: (questions: QuizQuestion[]) => void;
  onEditing: (editing: boolean) => void; disabled: boolean;
}) {
  const [draft, setDraft] = useState<QuizQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  function edit(question: QuizQuestion | null) {
    setDraft(question); setError(null); onEditing(!!question);
  }
  function save() {
    if (!draft || disabled) return;
    try {
      const exists = questions.some(q => q.id === draft.id);
      onChange(validateQuiz(exists ? questions.map(q => q.id === draft.id ? draft : q) : [...questions, draft]));
      edit(null);
    } catch (e) { setError((e as Error).message); }
  }
  return <View style={styles.section}>
    <Text style={styles.heading}>Knowledge Check</Text>
    <Text style={styles.text}>{questions.length} / 10 questions</Text>
    <Text style={styles.text}>Save your lesson to publish question changes.</Text>
    {questions.map((q, index) => <Card key={questionId(q, index)}>
      <View style={styles.section}>
        <Text style={styles.heading}>{index + 1}. {q.q}</Text>
        <Text style={styles.text}>Correct Answer: {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}</Text>
        <Button label={`Edit Question ${index + 1}`} variant="secondary" disabled={disabled || !!draft}
          onPress={() => edit({ ...q, options: [...q.options] })} />
        <Button label={`Delete Question ${index + 1}`} variant="ghost" disabled={disabled || !!draft}
          onPress={() => Alert.alert('Delete question?', 'Only this question will be removed when you save the lesson.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onChange(questions.filter(item => item.id !== q.id)) },
          ])} />
      </View>
    </Card>)}
    {error ? <Notice tone="error" message={error} /> : null}
    {draft ? <Card><View style={styles.section}>
      <Input label="Question" placeholder="Enter your question" value={draft.q} onChangeText={q => setDraft({ ...draft, q })} multiline />
      {draft.options.map((option, index) => <Input key={index} label={`Answer ${String.fromCharCode(65 + index)}`}
        placeholder={`Answer ${String.fromCharCode(65 + index)}`} value={option} onChangeText={text => setDraft({ ...draft, options: draft.options.map((o, i) => i === index ? text : o) })} />)}
      <Text style={styles.heading}>Correct Answer</Text>
      {draft.options.map((_, index) => <Button key={index}
        label={`${draft.answerIndex === index ? 'Selected: ' : ''}${String.fromCharCode(65 + index)}`}
        variant="secondary" icon={draft.answerIndex === index ? 'radio-button-on' : 'radio-button-off'}
        onPress={() => setDraft({ ...draft, answerIndex: index })} />)}
      <Button label="Save Question" onPress={save} disabled={disabled} />
      <Button label="Cancel Question" variant="ghost" onPress={() => edit(null)} />
    </View></Card> : <Button label="+ Add Question" variant="secondary" disabled={disabled || questions.length >= 10}
      onPress={() => edit({ id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`, q: '', options: ['', '', '', ''], answerIndex: -1 })} />}
    {questions.length >= 10 ? <Notice tone="info" message="Maximum 10 questions reached." /> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: spacing.md }, heading: { ...type.bodyStrong, color: colors.ink }, text: { ...type.body, color: colors.inkMuted } });
