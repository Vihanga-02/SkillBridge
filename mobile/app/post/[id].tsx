import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentRow } from '@/components/community/CommentRow';
import { PostCard } from '@/components/community/PostCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TEXT_LIMITS } from '@/constants/config';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  addComment,
  deletePost,
  getPost,
  listComments,
  toggleLike,
  type CommentCursor,
} from '@/services/postService';
import type { Comment, Post } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const postId = typeof id === 'string' ? id : '';
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCursor, setCommentCursor] = useState<CommentCursor>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);

  const load = useCallback(async () => {
    if (!postId) {
      setLoadError('This post link is incomplete.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [nextPost, commentPage] = await Promise.all([getPost(postId), listComments(postId)]);
      setPost(nextPost);
      setComments(commentPage.comments);
      setCommentCursor(commentPage.cursor);
      setHasMoreComments(commentPage.cursor !== null);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleLike() {
    if (!profile || !post || liking) return;

    setActionError(null);
    setLiking(true);
    try {
      const liked = await toggleLike(post.id, profile.uid);
      setPost((current) => {
        if (!current) return current;
        const likedBy = liked
          ? [...new Set([...(current.likedBy ?? []), profile.uid])]
          : (current.likedBy ?? []).filter((uid) => uid !== profile.uid);
        return { ...current, likedBy, likeCount: Math.max(0, (current.likeCount ?? 0) + (liked ? 1 : -1)) };
      });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setLiking(false);
    }
  }

  async function handleComment() {
    if (!profile || !post || !comment.trim() || commenting) return;

    setActionError(null);
    setCommenting(true);
    try {
      await addComment(post.id, profile, comment);
      setComment('');
      const commentPage = await listComments(post.id);
      setComments(commentPage.comments);
      setCommentCursor(commentPage.cursor);
      setHasMoreComments(commentPage.cursor !== null);
      setPost((current) =>
        current ? { ...current, commentCount: (current.commentCount ?? 0) + 1 } : current
      );
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setCommenting(false);
    }
  }

  async function loadMoreComments() {
    if (!post || !commentCursor || loadingMoreComments) return;

    setActionError(null);
    setLoadingMoreComments(true);
    try {
      const commentPage = await listComments(post.id, { cursor: commentCursor });
      setComments((current) => [...current, ...commentPage.comments]);
      setCommentCursor(commentPage.cursor);
      setHasMoreComments(commentPage.cursor !== null);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setLoadingMoreComments(false);
    }
  }

  function confirmDelete() {
    if (!profile || !post || deleting) return;

    Alert.alert('Delete post?', 'This will remove your post from the community feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void handleDelete(),
      },
    ]);
  }

  async function handleDelete() {
    if (!profile || !post) return;

    setActionError(null);
    setDeleting(true);
    try {
      await deletePost(post.id, profile.uid);
      router.back();
    } catch (error) {
      setActionError(errorMessage(error));
      setDeleting(false);
    }
  }

  if (!profile || loading) return <LoadingState fullScreen label="Loading post…" />;

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Post" showBack />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Post" showBack />
        <ErrorState message="This post is no longer available." onRetry={() => router.back()} retryLabel="Go back" />
      </SafeAreaView>
    );
  }

  const isAuthor = post.authorId === profile.uid;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Post"
          showBack
          action={
            isAuthor ? (
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Delete post"
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={sizes.iconMd} color={colors.danger} />
              </Pressable>
            ) : undefined
          }
        />

        {actionError ? <View style={styles.notice}><Notice tone="error" message={actionError} /></View> : null}

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CommentRow comment={item} />}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.postSection}>
              <PostCard
                post={post}
                currentUserId={profile.uid}
                liking={liking}
                onToggleLike={() => void handleToggleLike()}
                onOpenAuthor={() => router.push({ pathname: '/user/[id]', params: { id: post.authorId } })}
              />
              <Text style={styles.commentsTitle}>Comments</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="No comments yet"
              message="Start the conversation with a helpful comment."
            />
          }
          ListFooterComponent={
            hasMoreComments ? (
              <Button
                label="Load older comments"
                variant="secondary"
                loading={loadingMoreComments}
                onPress={() => void loadMoreComments()}
              />
            ) : null
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Write a comment…"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Write a comment"
            autoCapitalize="sentences"
            autoCorrect
            multiline
            maxLength={TEXT_LIMITS.comment}
            editable={!commenting}
            style={styles.input}
          />
          <Button
            label="Post"
            onPress={() => void handleComment()}
            loading={commenting}
            disabled={!comment.trim()}
            style={styles.commentButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: spacing.lg,
  },
  deleteButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  postSection: {
    gap: spacing.lg,
  },
  commentsTitle: {
    ...type.h2,
    color: colors.ink,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.ink,
    ...type.body,
    textAlignVertical: 'center',
  },
  commentButton: {
    alignSelf: 'flex-end',
  },
});
