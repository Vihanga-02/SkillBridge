/**
 * The single source of truth for every document shape in the app (§7).
 *
 * This file is the contract between the four components. Adding or renaming a
 * field here is a PR and a message in the group chat — Firestore has no
 * compile-time check of its own, so this file *is* the check.
 *
 * Read models use `Timestamp`. Writes always use `serverTimestamp()`, never
 * `new Date()` — device clocks lie and ordering breaks when one phone is off.
 */

import type { Timestamp } from 'firebase/firestore';

import type { CareerGoalTag } from '@/constants/careerGoals';
import type { Category, Level, SkillTag } from '@/constants/skills';

export type { Category, Level, Skill, SkillTag } from '@/constants/skills';
export type { CareerGoalTag } from '@/constants/careerGoals';

export type UserRole = 'learner' | 'teacher' | 'both';

/** Display shape of an offered skill. `skillTagsOffered` is the query shape. */
export type SkillOffered = {
  skill: SkillTag;
  label: string;
  level: Level;
  verified: boolean;
  credentialCount: number;
};

export type SkillWanted = {
  skill: SkillTag;
  label: string;
};

/**
 * A learner's chosen focus within one goal's curriculum. `skillTags` is the
 * subset of `skillsInGoal(goal)` they actually picked, not the full list —
 * mirrors `SkillOffered.skill` in that `goal` is the stable key M2/M3 will
 * key lesson/session progress off later.
 */
export type CareerGoal = {
  goal: CareerGoalTag;
  label: string;
  skillTags: SkillTag[];
};

export type UserStats = {
  sessionsTaught: number;
  sessionsAttended: number;
  lessonsCompleted: number;
};

/** `users/{uid}` — owner: Member 1, created by Auth. */
export type User = {
  uid: string;
  name: string;
  /** lowercase `name`, powers the prefix search in Discovery */
  nameLower: string;
  email: string;
  role: UserRole;
  bio: string;
  avatarUrl: string;
  location: string;
  skillsOffered: SkillOffered[];
  /** flat, lowercase — the only field `array-contains` can query */
  skillTagsOffered: SkillTag[];
  /** user-edited source of truth; `skillsWanted`/`skillTagsWanted` are derived from this + `extraSkillsWanted` */
  careerGoals: CareerGoal[];
  /** "no goal attached" bucket — the other source of truth feeding the derived fields */
  extraSkillsWanted: SkillTag[];
  /** derived union of `careerGoals[].skillTags` + `extraSkillsWanted` — read-only from the UI's perspective, kept for M2/M3 (§13) */
  skillsWanted: SkillWanted[];
  skillTagsWanted: SkillTag[];
  /** tags passed via the offline skill test — *the app tested them* */
  verifiedSkills: SkillTag[];
  /** denormalized size of the `credentials` subcollection */
  credentialCount: number;
  /** written ONLY by Member 4's review transaction */
  ratingAvg: number;
  /** written ONLY by Member 4's review transaction */
  ratingCount: number;
  credits: number;
  badges: string[];
  stats: UserStats;
  streak: number;
  /** 'YYYY-MM-DD' — compared against today for the streak */
  lastActiveDate: string;
  expoPushToken?: string;
  onboardingComplete: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type CredentialType =
  | 'certificate'
  | 'degree'
  | 'course'
  | 'award'
  | 'work_experience'
  | 'portfolio'
  | 'other';

/** `users/{uid}/credentials/{credentialId}` — owner: Member 1 (§5.1.1). */
export type Credential = {
  id: string;
  userId: string;
  /** must be one of the owner's `skillTagsOffered` */
  skillTag: SkillTag;
  type: CredentialType;
  title: string;
  issuer: string;
  issueDate: Timestamp;
  expiryDate?: Timestamp | null;
  referenceNo: string;
  verifyUrl: string;
  description: string;
  fileUrl: string;
  /** required for deletion */
  filePath: string;
  fileType: 'image' | 'pdf' | 'none';
  fileSizeBytes: number;
  visibility: 'public' | 'private';
  /** one value for now — always displayed as "Self-declared" */
  verificationStatus: 'self_declared';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type TestQuestion = {
  q: string;
  type: 'mcq';
  options?: string[];
  answer: string;
};

/** `fallback` and `gemini` are retained only for reading older attempt documents. */
export type SkillTestSource = 'hardcoded' | 'fallback' | 'gemini';

/** `skillTests/{testId}` — owner: Member 1. */
export type SkillTest = {
  id: string;
  userId: string;
  skillTag: SkillTag;
  questions: TestQuestion[];
  answers: string[];
  score: number;
  passed: boolean;
  source: SkillTestSource;
  createdAt: Timestamp | null;
};

export type LessonFormat = 'text' | 'flashcards' | 'video' | 'pdf';

export type Flashcard = { front: string; back: string };

export type QuizQuestion = { q: string; options: string[]; answerIndex: number };

export type LessonContent =
  | {
      id: string;
      type: 'youtube';
      title: string;
      videoId: string;
      url: string;
      createdAt?: Timestamp | null;
      updatedAt?: Timestamp | null;
    }
  | {
      id: string;
      type: 'pdf';
      title: string;
      fileName: string;
      fileUrl: string;
      filePath: string;
      fileSizeBytes: number;
      createdAt?: Timestamp | null;
      updatedAt?: Timestamp | null;
    };

/** `lessons/{lessonId}` — owner: Member 2. */
export type Lesson = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatarUrl: string;
  lessonName: string;
  careerGoalId: CareerGoalTag;
  careerGoalName: string;
  contents: LessonContent[];
  published: boolean;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string;
  title: string;
  description: string;
  skillTag: SkillTag;
  category: Category;
  level: Level;
  format: LessonFormat;
  content: string;
  cards: Flashcard[];
  mediaUrl: string;
  mediaPath: string;
  mediaSizeBytes: number;
  thumbnailUrl: string;
  durationMins: number;
  quiz: QuizQuestion[];
  quizSource: 'gemini' | 'manual';
  viewCount: number;
  completeCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** `lessonProgress/{uid}_{lessonId}` — owner: Member 2. Composite id keeps it idempotent. */
export type LessonProgress = {
  id: string;
  userId: string;
  lessonId: string;
  lessonTitle: string;
  skillTag: SkillTag;
  status: 'in_progress' | 'completed';
  lastCardIndex: number;
  quizScore: number;
  quizAttempts: number;
  minutesSpent: number;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** `enrollments/{uid}_{lessonId}` - one learner enrollment per lesson. */
export type LessonEnrollment = {
  id: string;
  userId: string;
  lessonId: string;
  lessonName: string;
  teacherId: string;
  teacherName: string;
  careerGoalId: CareerGoalTag;
  careerGoalName: string;
  contentCount: number;
  completedContentIds: string[];
  progress: number;
  completed: boolean;
  completedAt: Timestamp | null;
  enrolledAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type SessionMode = 'online' | 'in_person';
export type SessionType = 'one_to_one' | 'group';
export type SessionStatus = 'open' | 'full' | 'cancelled' | 'completed';

/** `sessions/{sessionId}` — owner: Member 3. A teacher's *offer*. */
export type Session = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatarUrl: string;
  teacherRatingAvg: number;
  title: string;
  description: string;
  descriptionSource: 'gemini' | 'manual';
  skillTag: SkillTag;
  category: Category;
  level: Level;
  type: SessionType;
  mode: SessionMode;
  meetingLink: string;
  locationText: string;
  startAt: Timestamp;
  durationMins: number;
  endAt: Timestamp;
  capacity: number;
  seatsTaken: number;
  /** Monotonic count used to lock editing once the first booking is requested. */
  bookingCount?: number;
  status: SessionStatus;
  coverImageUrl: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

/** `bookings/{bookingId}` — owner: Member 3. A learner's *claim on a seat*. */
export type Booking = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  skillTag: SkillTag;
  startAt: Timestamp;
  durationMins: number;
  mode: SessionMode;
  meetingLink: string;
  locationText: string;
  teacherId: string;
  teacherName: string;
  teacherAvatarUrl: string;
  learnerId: string;
  learnerName: string;
  learnerAvatarUrl: string;
  /** [teacherId, learnerId] — one `array-contains` query for "my bookings" */
  participantIds: string[];
  note: string;
  status: BookingStatus;
  cancelReason: string;
  /** must exist from creation — Member 4's review guard depends on them */
  reviewedByLearner: boolean;
  reviewedByTeacher: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** `reviews/{reviewId}` — owner: Member 4. */
export type Review = {
  id: string;
  bookingId: string;
  sessionId: string;
  skillTag: SkillTag;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatarUrl: string;
  toUserId: string;
  rating: number;
  comment: string;
  tags: string[];
  role: 'learner_to_teacher' | 'teacher_to_learner';
  createdAt: Timestamp | null;
};

export type ChatParticipant = { name: string; avatarUrl: string };

/** `chats/{chatId}` — owner: Member 4. Doc id = `[uidA, uidB].sort().join('_')`. */
export type Chat = {
  id: string;
  participantIds: string[];
  /** map, not parallel arrays — "who is the other person?" stays a one-liner */
  participants: Record<string, ChatParticipant>;
  lastMessage: string;
  lastSenderId: string;
  lastMessageAt: Timestamp | null;
  unreadCount: Record<string, number>;
  createdAt: Timestamp | null;
};

export type ModerationState = 'clean' | 'flagged' | 'skipped';

/** `chats/{chatId}/messages/{messageId}` — owner: Member 4. */
export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  imagePath?: string;
  moderation: ModerationState;
  createdAt: Timestamp | null;
};

export type PostType = 'achievement' | 'tip' | 'question';

/** `posts/{postId}` — owner: Member 4. */
export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  type: PostType;
  text: string;
  imageUrl?: string;
  imagePath?: string;
  skillTag?: SkillTag;
  likedBy: string[];
  likeCount: number;
  commentCount: number;
  moderation: ModerationState;
  createdAt: Timestamp | null;
};

/** `posts/{postId}/comments/{commentId}` — owner: Member 4. */
export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  createdAt: Timestamp | null;
};

/** `aiUsage/{uid}` — the daily Gemini cap (§11.4). */
export type AiUsage = {
  date: string;
  count: number;
  lastPromptType: string;
};
