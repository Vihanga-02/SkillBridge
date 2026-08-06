/**
 * [M1] Offline question bank for the Skill Verification Test.
 *
 * The plan generates these with Gemini (§11.3 feature 1), but every AI feature
 * needs a fallback that works with the Wi-Fi off — a test that crashes on stage
 * costs more marks than a test with fixed questions. Covers the eight most likely
 * demo skills; `aiService` will layer generation on top and fall back to here.
 */

import type { SkillTag, TestQuestion } from '@/types';

const mcq = (q: string, options: string[], answerIndex: number): TestQuestion => ({
  q,
  type: 'mcq',
  options,
  answer: options[answerIndex],
});

export const SKILL_TEST_BANK: Partial<Record<SkillTag, TestQuestion[]>> = {
  python: [
    mcq('Which of these creates a list in Python?', ['{1, 2, 3}', '[1, 2, 3]', '(1, 2, 3)', '<1, 2, 3>'], 1),
    mcq('What does `len("SkillBridge")` return?', ['10', '11', '12', 'An error'], 1),
    mcq(
      'Which keyword defines a function?',
      ['function', 'def', 'fun', 'define'],
      1
    ),
    mcq(
      'What is the result of `3 // 2` in Python 3?',
      ['1.5', '1', '2', 'An error'],
      1
    ),
  ],
  javascript: [
    mcq(
      'Which declaration creates a variable that cannot be reassigned?',
      ['var', 'let', 'const', 'static'],
      2
    ),
    mcq('What does `typeof []` return?', ["'array'", "'object'", "'list'", "'undefined'"], 1),
    mcq(
      'What does `===` check that `==` does not?',
      ['Reference equality', 'The type as well as the value', 'Only the type', 'Nothing, they are identical'],
      1
    ),
    mcq(
      'Which method adds an item to the end of an array?',
      ['unshift()', 'push()', 'shift()', 'concat()'],
      1
    ),
  ],
  react: [
    mcq(
      'What does a React hook let a function component do?',
      ['Extend a class', 'Use state and lifecycle features', 'Render on the server only', 'Skip re-rendering'],
      1
    ),
    mcq(
      'Which hook runs a side effect after render?',
      ['useState', 'useMemo', 'useEffect', 'useRef'],
      2
    ),
    mcq(
      'Why does a list of elements need a stable `key`?',
      [
        'To style each row',
        'So React can match elements between renders',
        'To make the list scrollable',
        'It is optional and has no effect',
      ],
      1
    ),
    mcq(
      'What happens if you call a state setter during render?',
      ['Nothing', 'It causes an infinite render loop', 'The value is ignored', 'It updates silently'],
      1
    ),
  ],
  sql: [
    mcq(
      'Which clause filters rows before grouping?',
      ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'],
      1
    ),
    mcq(
      'What does an INNER JOIN return?',
      [
        'All rows from both tables',
        'Only rows with a match in both tables',
        'All rows from the left table',
        'Rows with no match',
      ],
      1
    ),
    mcq('Which statement removes a table entirely?', ['DELETE', 'TRUNCATE', 'DROP', 'REMOVE'], 2),
    mcq(
      'What does COUNT(*) return for an empty table?',
      ['NULL', '0', 'An error', 'An empty string'],
      1
    ),
  ],
  figma: [
    mcq(
      'What is the point of a Figma component?',
      ['To lock a layer', 'To reuse one definition across many instances', 'To export an image', 'To add a comment'],
      1
    ),
    mcq(
      'Auto layout is used to…',
      [
        'Animate between frames',
        'Space and resize children automatically',
        'Convert vectors to bitmaps',
        'Share a file',
      ],
      1
    ),
    mcq(
      'What does a constraint on a layer control?',
      ['Its colour', 'How it behaves when its frame resizes', 'Its export format', 'Its opacity'],
      1
    ),
    mcq(
      'Which feature keeps colours consistent across a file?',
      ['Styles and variables', 'Groups', 'Frames', 'Slices'],
      0
    ),
  ],
  photoshop: [
    mcq(
      'What is a non-destructive way to change brightness?',
      ['Paint over it', 'An adjustment layer', 'Flatten the image', 'Crop the canvas'],
      1
    ),
    mcq(
      'What does a layer mask do?',
      ['Deletes pixels permanently', 'Hides parts of a layer reversibly', 'Adds a border', 'Changes resolution'],
      1
    ),
    mcq(
      'Which format keeps layers when you save?',
      ['JPG', 'PNG', 'PSD', 'GIF'],
      2
    ),
    mcq(
      'What does resolution measure?',
      ['Total file size', 'Pixels per inch', 'Colour depth', 'Number of layers'],
      1
    ),
  ],
  'spoken-english': [
    mcq(
      'Choose the correct sentence.',
      ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", 'She not like coffee.'],
      2
    ),
    mcq(
      'Which is the past tense of "teach"?',
      ['teached', 'taught', 'teachen', 'teaching'],
      1
    ),
    mcq(
      'Pick the correct question form.',
      ['Where you are going?', 'Where are you going?', 'Where going you are?', 'Where you going are?'],
      1
    ),
    mcq(
      'Which word is a synonym for "improve"?',
      ['worsen', 'enhance', 'ignore', 'delay'],
      1
    ),
  ],
  guitar: [
    mcq(
      'How many strings does a standard guitar have?',
      ['4', '5', '6', '7'],
      2
    ),
    mcq(
      'What is standard tuning, from the lowest string?',
      ['E A D G B E', 'D A D G A D', 'C G D A E B', 'E A D G C F'],
      0
    ),
    mcq(
      'What does a capo do?',
      ['Mutes the strings', 'Raises the pitch of every string', 'Tunes the guitar', 'Amplifies the sound'],
      1
    ),
    mcq(
      'A barre chord is played by…',
      [
        'Strumming one string',
        'Pressing several strings with one finger',
        'Muting the low E string',
        'Playing only open strings',
      ],
      1
    ),
  ],
};

export const hasTestFor = (skillTag: string): boolean => skillTag in SKILL_TEST_BANK;

export const getTestQuestions = (skillTag: SkillTag): TestQuestion[] =>
  SKILL_TEST_BANK[skillTag] ?? [];
