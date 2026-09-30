import type { Lesson, LessonEnrollment, QuizQuestion } from '@/types';

export const MAX_LESSON_QUESTIONS = 10;
export const questionId = (question: QuizQuestion, index: number) => question.id || `legacy-question-${index}`;

export function validateQuiz(quiz: QuizQuestion[]): QuizQuestion[] {
  if (quiz.length > MAX_LESSON_QUESTIONS) throw new Error('Maximum 10 questions reached.');
  const ids = new Set<string>();
  return quiz.map((question, index) => {
    if (!question.q.trim()) throw new Error('Please enter a question.');
    if (question.options.length !== 4 || question.options.some(option => !option.trim())) {
      throw new Error('Please complete all four answer options.');
    }
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) {
      throw new Error('Please select the correct answer.');
    }
    const id = questionId(question, index);
    if (ids.has(id)) throw new Error('Duplicate question ID.');
    ids.add(id);
    return { id, q: question.q.trim(), options: question.options.map(option => option.trim()), answerIndex: question.answerIndex };
  });
}

/** Calculate against current requirements without rewriting historical attempts. */
export function lessonCompletion(lesson: Pick<Lesson, 'contents' | 'quiz'>,
  enrollment: Pick<LessonEnrollment, 'completedContentIds' | 'quizAnswers'>) {
  const done = new Set(enrollment.completedContentIds);
  const quiz = lesson.quiz ?? [];
  const answers = enrollment.quizAnswers ?? {};
  const materialsDone = lesson.contents.filter(item => done.has(item.id)).length;
  const submitted = quiz.map((q, i) => answers[questionId(q, i)]).filter(a => a?.submitted === true);
  const correct = submitted.filter(a => a.correct).length;
  const total = lesson.contents.length + quiz.length;
  const completedItems = materialsDone + submitted.length;
  const completed = total > 0 && completedItems === total;
  return { total, completedItems, completed, submitted: submitted.length, correct,
    quizScore: quiz.length ? Math.round(correct / quiz.length * 100) : 0,
    progress: completed ? 100 : total ? Math.min(99, Math.round(completedItems / total * 100)) : 0 };
}
