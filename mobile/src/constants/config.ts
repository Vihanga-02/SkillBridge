/**
 * Shared limits. Enforce every file-size cap client-side *before* the upload
 * starts — Storage rules reject an oversized file only after it has been sent.
 */

const MB = 1024 * 1024;

export const FILE_LIMITS = {
  avatar: 1 * MB,
  credential: 5 * MB,
  lessonImage: 2 * MB,
  lessonPdf: 10 * MB,
  lessonVideo: 50 * MB,
  sessionCover: 1 * MB,
  chatImage: 2 * MB,
  postImage: 2 * MB,
} as const;

export const PAGE_SIZE = {
  discovery: 12,
  lessons: 10,
  sessions: 10,
  posts: 10,
  comments: 30,
  messages: 50,
  reviews: 10,
} as const;

/** Per-user daily Gemini cap, tracked in `aiUsage/{uid}` (§11.4). */
export const AI_DAILY_QUOTA = 20;

export const TEXT_LIMITS = {
  name: { min: 2, max: 60 },
  password: { min: 6, max: 64 },
  bio: 300,
  credentialTitle: { min: 3, max: 120 },
  credentialIssuer: { min: 2, max: 80 },
  credentialDescription: 300,
  reviewComment: 500,
  post: 1000,
  comment: 500,
} as const;

/** Quiz / skill-test pass mark, as a percentage. */
export const PASS_MARK = 60;

export const ONBOARDING = {
  minSkillsOffered: 1,
  minSkillsWanted: 1,
  /** Starting balance for the SDG 8 credit story (§12.2). */
  welcomeCredits: 10,
} as const;
