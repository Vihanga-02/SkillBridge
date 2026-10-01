import { useState } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { KnowledgeCheck } from '@/components/lesson/KnowledgeCheck';
import { KnowledgeCheckEditor } from '@/components/lesson/KnowledgeCheckEditor';
import { lessonCompletion, validateQuiz } from '@/utils/lessonProgress';
import type { Lesson, LessonEnrollment, QuizQuestion } from '@/types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const question = { id: 'q1', q: 'What is Git?', options: ['Database', 'Version control', 'Video', 'Design'], answerIndex: 1 };
const lesson = { contents: [], quiz: [question] } as unknown as Lesson;
const enrollment = { completedContentIds: [], quizAnswers: {} } as unknown as LessonEnrollment;

it('shows no feedback before submission and requires selecting exactly one option', async () => {
  const submit = jest.fn();
  const screen = await render(<KnowledgeCheck lesson={lesson} enrollment={enrollment} onSubmit={submit} onRetry={jest.fn()} busy={false} />);
  expect(screen.queryByText(/Correct answer:/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Submit Answer' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Database' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Design' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Submit Answer' }));
  expect(submit).toHaveBeenCalledWith('q1', 3);
});
it.each([false, true])('restores persisted feedback and score for a correct=%s attempt', async correct => {
  const retry = jest.fn();
  const saved = { ...enrollment, quizAnswers: { q1: {
    questionId: 'q1', question: question.q, options: question.options, answerIndex: 1,
    selectedIndex: correct ? 1 : 0, correct, submitted: true as const, submittedAt: 123,
  } } };
  const screen = await render(<KnowledgeCheck lesson={lesson} enrollment={saved} onSubmit={jest.fn()} onRetry={retry} busy={false} />);
  expect(screen.getByText('Correct answer: Version control')).toBeTruthy();
  expect(screen.getByText(correct ? 'Correct!' : 'Incorrect')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Submit Answer' })).toBeNull();
  if (correct) {
    expect(screen.getByText('Knowledge Check Passed. Score: 1 / 1 (100%)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Knowledge Check Again' })).toBeNull();
  } else {
    expect(screen.getByText('Score: 0 / 1 (0%). You need 60% to pass.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Knowledge Check Again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  }
});
function Editor({ initial = [] }: { initial?: QuizQuestion[] }) {
  const [questions, setQuestions] = useState(initial);
  return <KnowledgeCheckEditor questions={questions} onChange={setQuestions} onEditing={() => {}} disabled={false} />;
}
it('requires explicit correct-answer selection and trims saved questions', async () => {
  const screen = await render(<Editor />);
  await fireEvent.press(screen.getByRole('button', { name: '+ Add Question' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Question' }));
  expect(screen.getByText('Please enter a question.')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('Enter your question'), '  What is Git?  ');
  for (let i = 0; i < 4; i++) await fireEvent.changeText(screen.getByPlaceholderText(`Answer ${String.fromCharCode(65 + i)}`), question.options[i]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save Question' }));
  expect(screen.getByText('Please select the correct answer.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'B' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Question' }));
  expect(screen.getByText('1. What is Git?')).toBeTruthy();
  expect(screen.getByText('Correct Answer: B. Version control')).toBeTruthy();
});
it('edits in place at ten questions, disables adding, and enables adding after confirmed deletion', async () => {
  const screen = await render(<Editor initial={Array.from({ length: 10 }, (_, i) => ({ ...question, id: 'q' + i }))} />);
  expect(screen.getByRole('button', { name: '+ Add Question' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit Question 4' }));
  expect(screen.getByPlaceholderText('Enter your question').props.value).toBe(question.q);
  expect(screen.getByRole('button', { name: 'Selected: B' })).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('Enter your question'), 'Edited question');
  await fireEvent.press(screen.getByRole('button', { name: 'Save Question' }));
  expect(screen.getByText('10 / 10 questions')).toBeTruthy();
  expect(screen.getByText('4. Edited question')).toBeTruthy();
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.find(b => b.text === 'Delete')?.onPress?.(); });
  await fireEvent.press(screen.getByRole('button', { name: 'Delete Question 7' }));
  expect(screen.getByText('9 / 10 questions')).toBeTruthy();
  expect(screen.getByRole('button', { name: '+ Add Question' }).props.accessibilityState.disabled).toBe(false);
  jest.restoreAllMocks();
});
it.each([
  [{ ...question, q: '  ' }, 'enter a question'],
  [{ ...question, options: ['a', '', 'c', 'd'] }, 'complete all four'],
  [{ ...question, answerIndex: -1 }, 'select the correct'],
  [{ ...question, answerIndex: 4 }, 'select the correct'],
  [{ ...question, answerIndex: 1.5 }, 'select the correct'],
] as const)('validates malformed question %#', (q, message) => {
  expect(() => validateQuiz([q as QuizQuestion])).toThrow(message);
});
it('handles multiple materials, removed IDs, empty lessons and rounding without premature completion', () => {
  const contents = Array.from({ length: 201 }, (_, i) => ({ id: String(i), type: 'pdf' })) as Lesson['contents'];
  const row = { ...enrollment, completedContentIds: [...contents.slice(1).map(c => c.id), 'removed', 'removed'] };
  expect(lessonCompletion({ contents, quiz: [] }, row)).toMatchObject({ completed: false, progress: 99 });
  expect(lessonCompletion({ contents: [], quiz: [] }, row)).toMatchObject({ completed: false, progress: 0 });
});
it('requires a score of at least sixty percent to complete a lesson quiz', () => {
  const quiz = Array.from({ length: 5 }, (_, index) => ({ ...question, id: `q${index}` }));
  const answers = Object.fromEntries(quiz.map((q, index) => [q.id, {
    questionId: q.id, question: q.q, options: q.options, answerIndex: q.answerIndex,
    selectedIndex: index < 3 ? q.answerIndex : 0, correct: index < 3,
    submitted: true as const, submittedAt: 123,
  }]));
  expect(lessonCompletion({ contents: [], quiz }, { completedContentIds: [], quizAnswers: answers }))
    .toMatchObject({ completed: true, quizPassed: true, quizScore: 60 });
  answers.q2 = { ...answers.q2, selectedIndex: 0, correct: false };
  expect(lessonCompletion({ contents: [], quiz }, { completedContentIds: [], quizAnswers: answers }))
    .toMatchObject({ completed: false, quizPassed: false, quizScore: 40, progress: 99 });
});
