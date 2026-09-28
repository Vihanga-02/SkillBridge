import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { FILE_LIMITS, PAGE_SIZE, TEXT_LIMITS } from '@/constants/config';
import { skillByTag } from '@/constants/skills';
import { db } from '@/firebase/config';
import {
  communityImagePath,
  validateCommunityImageUpload,
  type CommunityImageUpload,
} from '@/services/communityMedia';
import type {
  Comment,
  CommentReaction,
  CommentReactions,
  Post,
  PostType,
  SkillTag,
  User,
} from '@/types';
import { deleteFile, uploadFile } from '@/utils/storage';

const postsCol = collection(db, 'posts');
const POST_TYPES: PostType[] = ['achievement', 'tip', 'question'];

export type PostAuthor = Pick<User, 'uid' | 'name' | 'avatarUrl'>;
export type PostCursor = QueryDocumentSnapshot<DocumentData> | null;

export type CreatePostInput = {
  type: PostType;
  text: string;
  skillTag?: SkillTag | null;
  image?: CommunityImageUpload | null;
};

export type ListPostsOptions = {
  type?: PostType;
  pageSize?: number;
  cursor?: PostCursor;
};

export type PostPage = {
  posts: Post[];
  cursor: PostCursor;
};

export type CommentCursor = QueryDocumentSnapshot<DocumentData> | null;

export type ListCommentsOptions = {
  pageSize?: number;
  cursor?: CommentCursor;
};

export type CommentPage = {
  comments: Comment[];
  cursor: CommentCursor;
};

/** Quick reactions supported on both comments and their direct replies. */
export const COMMENT_REACTIONS = [
  { value: 'like', label: 'Like', emoji: '👍' },
  { value: 'love', label: 'Love', emoji: '❤️' },
  { value: 'celebrate', label: 'Celebrate', emoji: '🎉' },
] as const satisfies readonly { value: CommentReaction; label: string; emoji: string }[];

const COMMENT_DELETE_BATCH_SIZE = 450;

const toPost = (snapshot: QueryDocumentSnapshot<DocumentData>): Post =>
  ({ ...snapshot.data(), id: snapshot.id }) as Post;

function emptyCommentReactions(): CommentReactions {
  return { like: [], love: [], celebrate: [] };
}

function normalizeCommentReactions(value: unknown): CommentReactions {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalized = emptyCommentReactions();

  for (const reaction of COMMENT_REACTIONS) {
    const userIds = raw[reaction.value];
    normalized[reaction.value] = Array.isArray(userIds)
      ? [...new Set(userIds.filter((id): id is string => typeof id === 'string' && !!id))]
      : [];
  }

  return normalized;
}

const toComment = (snapshot: QueryDocumentSnapshot<DocumentData>): Comment => {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    parentCommentId: typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    replyCount: Number.isSafeInteger(data.replyCount) && data.replyCount > 0 ? data.replyCount : 0,
    reactions: normalizeCommentReactions(data.reactions),
  } as Comment;
};

function timestampMillis(value: Post['createdAt']): number {
  return value?.toMillis?.() ?? 0;
}

function validatePostInput(input: CreatePostInput): { text: string; skillTag?: SkillTag } {
  if (!POST_TYPES.includes(input.type)) {
    throw new Error('Choose a valid post type.');
  }

  const text = input.text.trim();
  if (!text) throw new Error('Write something before publishing your post.');
  if (text.length > TEXT_LIMITS.post) {
    throw new Error(`Posts must be ${TEXT_LIMITS.post} characters or fewer.`);
  }

  if (input.skillTag && !skillByTag(input.skillTag)) {
    throw new Error('Choose a skill from the SkillBridge list.');
  }

  return { text, ...(input.skillTag ? { skillTag: input.skillTag } : {}) };
}

/** Creates a post with optional image media and removes a failed upload if Firestore rejects the post. */
export async function createPost(author: PostAuthor, input: CreatePostInput): Promise<string> {
  const { text, skillTag } = validatePostInput(input);
  const postRef = doc(postsCol);
  const image = input.image ? validateCommunityImageUpload(input.image) : null;
  let upload: { url: string; path: string } | null = null;

  if (image) {
    const path = communityImagePath('posts', postRef.id, postRef.id, image.contentType);
    upload = await uploadFile(path, image.uri, FILE_LIMITS.postImage, image.contentType);
  }

  try {
    await runTransaction(db, async (transaction) => {
      transaction.set(postRef, {
        id: postRef.id,
        authorId: author.uid,
        authorName: author.name,
        authorAvatarUrl: author.avatarUrl ?? '',
        type: input.type,
        text,
        ...(skillTag ? { skillTag } : {}),
        ...(upload ? { imageUrl: upload.url, imagePath: upload.path } : {}),
        likedBy: [],
        likeCount: 0,
        commentCount: 0,
        // Gemini moderation is deliberately not part of this core flow.
        moderation: 'skipped',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (upload) await deleteFile(upload.path).catch(() => undefined);
    throw error;
  }

  return postRef.id;
}

/**
 * Gets one feed page. A temporary client-sort fallback keeps the type filter
 * usable until the `posts.type + createdAt` index has finished building.
 */
export async function listPosts({
  type,
  pageSize = PAGE_SIZE.posts,
  cursor = null,
}: ListPostsOptions = {}): Promise<PostPage> {
  const safePageSize = Math.max(1, Math.min(pageSize, PAGE_SIZE.posts));
  const constraints: QueryConstraint[] = [];

  if (type) constraints.push(where('type', '==', type));
  constraints.push(orderBy('createdAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(safePageSize + 1));

  try {
    const snapshot = await getDocs(query(postsCol, ...constraints));
    const visible = snapshot.docs.slice(0, safePageSize);
    return {
      posts: visible.map(toPost),
      cursor: snapshot.docs.length > safePageSize ? visible[visible.length - 1] ?? null : null,
    };
  } catch (error) {
    // A filtered + ordered query needs a composite index. Before it exists, a
    // single-field filter is still safe; pagination is withheld until the real
    // index is available so no posts are silently skipped.
    if (cursor) throw error;

    const fallback = type ? query(postsCol, where('type', '==', type)) : query(postsCol);
    const snapshot = await getDocs(fallback);
    const posts = snapshot.docs.map(toPost).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    return { posts: posts.slice(0, safePageSize), cursor: null };
  }
}

export async function getPost(postId: string): Promise<Post | null> {
  const snapshot = await getDoc(doc(postsCol, postId));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Post) : null;
}

/** Lets only the post author update the text caption while retaining its media and metadata. */
export async function editPostCaption(
  postId: string,
  authorId: string,
  rawText: string
): Promise<string> {
  const text = rawText.trim();
  if (!text) throw new Error('Write a caption before saving.');
  if (text.length > TEXT_LIMITS.post) {
    throw new Error(`Posts must be ${TEXT_LIMITS.post} characters or fewer.`);
  }

  const postRef = doc(postsCol, postId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists() || snapshot.data().deleting === true) {
      throw new Error('This post is no longer available.');
    }
    if (snapshot.data().authorId !== authorId) {
      throw new Error('Only the author can edit this caption.');
    }

    transaction.update(postRef, { text, updatedAt: serverTimestamp() });
  });

  return text;
}

/** Returns whether the post is liked after the operation finishes. */
export async function toggleLike(postId: string, uid: string): Promise<boolean> {
  const postRef = doc(postsCol, postId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) throw new Error('This post is no longer available.');

    const likedBy = Array.isArray(snapshot.data().likedBy)
      ? snapshot.data().likedBy.map(String)
      : [];
    const alreadyLiked = likedBy.includes(uid);

    transaction.update(postRef, {
      likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
      likeCount: increment(alreadyLiked ? -1 : 1),
    });

    return !alreadyLiked;
  });
}

export async function addComment(postId: string, author: PostAuthor, rawText: string): Promise<string> {
  const text = rawText.trim();
  if (!text) throw new Error('Write a comment before posting it.');
  if (text.length > TEXT_LIMITS.comment) {
    throw new Error(`Comments must be ${TEXT_LIMITS.comment} characters or fewer.`);
  }

  const postRef = doc(postsCol, postId);
  const commentRef = doc(collection(postRef, 'comments'));

  await runTransaction(db, async (transaction) => {
    const postSnapshot = await transaction.get(postRef);
    if (!postSnapshot.exists() || postSnapshot.data().deleting === true) {
      throw new Error('This post is no longer available.');
    }

    transaction.set(commentRef, {
      id: commentRef.id,
      authorId: author.uid,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl ?? '',
      text,
      parentCommentId: null,
      replyCount: 0,
      reactions: emptyCommentReactions(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(postRef, { commentCount: increment(1) });
  });

  return commentRef.id;
}

/** Adds one direct reply to an existing top-level comment. */
export async function addCommentReply(
  postId: string,
  parentCommentId: string,
  author: PostAuthor,
  rawText: string
): Promise<string> {
  const text = rawText.trim();
  if (!text) throw new Error('Write a reply before posting it.');
  if (text.length > TEXT_LIMITS.comment) {
    throw new Error(`Replies must be ${TEXT_LIMITS.comment} characters or fewer.`);
  }

  const postRef = doc(postsCol, postId);
  const parentRef = doc(postRef, 'comments', parentCommentId);
  const replyRef = doc(collection(parentRef, 'replies'));

  await runTransaction(db, async (transaction) => {
    const [postSnapshot, parentSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(parentRef),
    ]);
    if (!postSnapshot.exists() || postSnapshot.data().deleting === true || !parentSnapshot.exists()) {
      throw new Error('This comment is no longer available for replies.');
    }

    transaction.set(replyRef, {
      id: replyRef.id,
      authorId: author.uid,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl ?? '',
      text,
      parentCommentId,
      replyCount: 0,
      reactions: emptyCommentReactions(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(parentRef, {
      replyCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    transaction.update(postRef, { commentCount: increment(1) });
  });

  return replyRef.id;
}

/**
 * Gets the newest comments first. The cursor lets the detail screen load older
 * comments instead of permanently hiding comments after the first page.
 */
export async function listComments(
  postId: string,
  { pageSize = PAGE_SIZE.comments, cursor = null }: ListCommentsOptions = {}
): Promise<CommentPage> {
  const safePageSize = Math.max(1, Math.min(pageSize, PAGE_SIZE.comments));
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(safePageSize + 1));

  const snapshot = await getDocs(query(collection(db, 'posts', postId, 'comments'), ...constraints));
  const visible = snapshot.docs.slice(0, safePageSize);

  return {
    comments: visible.map(toComment),
    cursor: snapshot.docs.length > safePageSize ? visible[visible.length - 1] ?? null : null,
  };
}

/** Returns direct replies oldest-first, so each small conversation reads naturally. */
export async function listCommentReplies(
  postId: string,
  parentCommentId: string,
  { pageSize = PAGE_SIZE.comments, cursor = null }: ListCommentsOptions = {}
): Promise<CommentPage> {
  const safePageSize = Math.max(1, Math.min(pageSize, PAGE_SIZE.comments));
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'asc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(safePageSize + 1));

  const snapshot = await getDocs(
    query(collection(db, 'posts', postId, 'comments', parentCommentId, 'replies'), ...constraints)
  );
  const visible = snapshot.docs.slice(0, safePageSize);

  return {
    comments: visible.map(toComment),
    cursor: snapshot.docs.length > safePageSize ? visible[visible.length - 1] ?? null : null,
  };
}

/**
 * Selects one reaction per user. Selecting the same reaction again removes it;
 * choosing another switches the existing reaction atomically.
 */
export async function toggleCommentReaction(
  postId: string,
  commentId: string,
  uid: string,
  reaction: CommentReaction,
  parentCommentId?: string
): Promise<CommentReaction | null> {
  if (!uid) throw new Error('Sign in to react to a comment.');

  const commentRef = parentCommentId
    ? doc(db, 'posts', postId, 'comments', parentCommentId, 'replies', commentId)
    : doc(db, 'posts', postId, 'comments', commentId);
  const postRef = doc(postsCol, postId);

  return runTransaction(db, async (transaction) => {
    const [postSnapshot, snapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(commentRef),
    ]);
    if (!postSnapshot.exists() || postSnapshot.data().deleting === true || !snapshot.exists()) {
      throw new Error('This comment is no longer available.');
    }

    const reactions = normalizeCommentReactions(snapshot.data().reactions);
    const selected =
      COMMENT_REACTIONS.find((item) => reactions[item.value].includes(uid))?.value ?? null;

    for (const item of COMMENT_REACTIONS) {
      reactions[item.value] = reactions[item.value].filter((reactorId) => reactorId !== uid);
    }
    if (selected !== reaction) reactions[reaction] = [...reactions[reaction], uid];

    transaction.update(commentRef, { reactions, updatedAt: serverTimestamp() });
    return selected === reaction ? null : reaction;
  });
}

async function deleteCommentReplies(postRef: ReturnType<typeof doc>, commentId: string): Promise<void> {
  const repliesCol = collection(postRef, 'comments', commentId, 'replies');

  while (true) {
    const snapshot = await getDocs(query(repliesCol, limit(COMMENT_DELETE_BATCH_SIZE)));
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((reply) => batch.delete(reply.ref));
    await batch.commit();
  }
}

/**
 * Removes the post and every nested comment. Firestore does not cascade a
 * document delete into subcollections, so the post is first marked as deleting
 * to reject new comments while batched cleanup runs. The final security rules
 * must let a post author delete comments belonging to their own post.
 */
export async function deletePost(postId: string, authorId: string): Promise<void> {
  const postRef = doc(postsCol, postId);
  const commentsCol = collection(postRef, 'comments');
  let deletionStarted = false;
  let imagePath = '';

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(postRef);
      if (!snapshot.exists()) throw new Error('This post is no longer available.');
      if (snapshot.data().authorId !== authorId) {
        throw new Error('Only the author can delete this post.');
      }
      if (snapshot.data().deleting === true) {
        throw new Error('This post is already being deleted.');
      }

      imagePath = typeof snapshot.data().imagePath === 'string' ? snapshot.data().imagePath : '';
      transaction.update(postRef, { deleting: true });
    });
    deletionStarted = true;

    // Querying a limited page again after deleting it walks the entire
    // subcollection without exceeding Firestore's 500-operation batch limit.
    while (true) {
      const snapshot = await getDocs(query(commentsCol, limit(COMMENT_DELETE_BATCH_SIZE)));
      if (snapshot.empty) break;

      // Firestore does not cascade a parent document deletion into replies.
      // Remove every reply page before the parent comment is batched away.
      for (const comment of snapshot.docs) {
        await deleteCommentReplies(postRef, comment.id);
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((comment) => batch.delete(comment.ref));
      await batch.commit();
    }

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(postRef);
      if (!snapshot.exists()) return;
      if (snapshot.data().authorId !== authorId) {
        throw new Error('Only the author can delete this post.');
      }

      transaction.delete(postRef);
    });

    // Storage has no cross-service transaction with Firestore. The document is
    // already gone, so a failed cleanup must not make the UI claim deletion failed.
    if (imagePath) await deleteFile(imagePath).catch(() => undefined);
  } catch (error) {
    // A failed cleanup must not leave a normal post permanently unavailable.
    if (deletionStarted) {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(postRef);
        if (snapshot.exists() && snapshot.data().authorId === authorId && snapshot.data().deleting === true) {
          transaction.update(postRef, { deleting: false });
        }
      }).catch(() => undefined);
    }
    throw error;
  }
}
