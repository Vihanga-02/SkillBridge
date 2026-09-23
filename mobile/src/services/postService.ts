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

import { PAGE_SIZE, TEXT_LIMITS } from '@/constants/config';
import { skillByTag } from '@/constants/skills';
import { db } from '@/firebase/config';
import type { Comment, Post, PostType, SkillTag, User } from '@/types';

const postsCol = collection(db, 'posts');
const POST_TYPES: PostType[] = ['achievement', 'tip', 'question'];

export type PostAuthor = Pick<User, 'uid' | 'name' | 'avatarUrl'>;
export type PostCursor = QueryDocumentSnapshot<DocumentData> | null;

export type CreatePostInput = {
  type: PostType;
  text: string;
  skillTag?: SkillTag | null;
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

const COMMENT_DELETE_BATCH_SIZE = 450;

const toPost = (snapshot: QueryDocumentSnapshot<DocumentData>): Post =>
  ({ ...snapshot.data(), id: snapshot.id }) as Post;

const toComment = (snapshot: QueryDocumentSnapshot<DocumentData>): Comment =>
  ({ ...snapshot.data(), id: snapshot.id }) as Comment;

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

/** Creates a text-only community post. Image uploads remain a later enhancement. */
export async function createPost(author: PostAuthor, input: CreatePostInput): Promise<string> {
  const { text, skillTag } = validatePostInput(input);
  const postRef = doc(postsCol);

  await runTransaction(db, async (transaction) => {
    transaction.set(postRef, {
      id: postRef.id,
      authorId: author.uid,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl ?? '',
      type: input.type,
      text,
      ...(skillTag ? { skillTag } : {}),
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
      // Gemini moderation is deliberately not part of this text-only core flow.
      moderation: 'skipped',
      createdAt: serverTimestamp(),
    });
  });

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
      createdAt: serverTimestamp(),
    });
    transaction.update(postRef, { commentCount: increment(1) });
  });

  return commentRef.id;
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

      transaction.update(postRef, { deleting: true });
    });
    deletionStarted = true;

    // Querying a limited page again after deleting it walks the entire
    // subcollection without exceeding Firestore's 500-operation batch limit.
    while (true) {
      const snapshot = await getDocs(query(commentsCol, limit(COMMENT_DELETE_BATCH_SIZE)));
      if (snapshot.empty) break;

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
