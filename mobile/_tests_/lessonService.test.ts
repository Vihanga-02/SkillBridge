jest.mock('../src/firebase/config', () => ({ db: {} }));

jest.mock('../src/utils/storage', () => ({
  deleteFile: jest.fn(),
  sanitizeStorageName: jest.fn((value: string) => value),
  uploadFile: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({ id: 'generated-id' })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn((value: number) => value),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

import { extractYouTubeVideoId, youtubeEmbedUrl } from '../src/services/lessonService';

describe('lesson YouTube URL parsing', () => {
  it.each([
    'dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
  ])('accepts a valid 11-character video ID from %s', (value) => {
    expect(extractYouTubeVideoId(value)).toBe('dQw4w9WgXcQ');
  });

  it('rejects an encoded script-closing payload in a watch parameter', () => {
    const maliciousUrl = 'https://youtube.com/watch?v=%3C%2Fscript%3Exx';

    expect(extractYouTubeVideoId(maliciousUrl)).toBeNull();
    expect(youtubeEmbedUrl(maliciousUrl)).toBeNull();
  });

  it.each([
    'https://youtube.com/watch?v=too-short',
    'https://youtube.com/watch?v=dQw4w9WgXc!',
    'https://attacker.example/watch?v=dQw4w9WgXcQ',
  ])('rejects an invalid video URL: %s', (value) => {
    expect(extractYouTubeVideoId(value)).toBeNull();
  });
});
