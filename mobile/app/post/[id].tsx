import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  addCommentReply,
  deletePost,
  editPostCaption,
  getPost,
  listCommentReplies,
  listComments,
  toggleCommentReaction,
  toggleLike,
  COMMENT_REACTIONS,
  type CommentCursor,
} from '@/services/postService';
import type { Comment, CommentReaction, Post } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type ReplyPageState = {
  comments: Comment[];
  cursor: CommentCursor;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
  loadingMore: boolean;
};

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
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [replyPages, setReplyPages] = useState<Record<string, ReplyPageState>>({});
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(new Set());
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

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

  async function fetchReplies(parentCommentId: string, cursor: CommentCursor | null = null) {
    if (!post) return;

    setReplyPages((current) => {
      const existing = current[parentCommentId];
      return {
        ...current,
        [parentCommentId]: {
          comments: existing?.comments ?? [],
          cursor: existing?.cursor ?? null,
          hasMore: existing?.hasMore ?? false,
          loaded: existing?.loaded ?? false,
          loading: cursor === null,
          loadingMore: cursor !== null,
        },
      };
    });

    try {
      const page = await listCommentReplies(post.id, parentCommentId, { cursor });
      setReplyPages((current) => {
        const existing = current[parentCommentId];
        return {
          ...current,
          [parentCommentId]: {
            comments: cursor ? [...(existing?.comments ?? []), ...page.comments] : page.comments,
            cursor: page.cursor,
            hasMore: page.cursor !== null,
            loaded: true,
            loading: false,
            loadingMore: false,
          },
        };
      });
    } catch (error) {
      setActionError(errorMessage(error));
      setReplyPages((current) => {
        const existing = current[parentCommentId];
        return {
          ...current,
          [parentCommentId]: {
            comments: existing?.comments ?? [],
            cursor: existing?.cursor ?? null,
            hasMore: existing?.hasMore ?? false,
            loaded: existing?.loaded ?? false,
            loading: false,
            loadingMore: false,
          },
        };
      });
    }
  }

  async function toggleReplies(parentCommentId: string) {
    const isExpanded = expandedReplyIds.has(parentCommentId);
    setExpandedReplyIds((current) => {
      const next = new Set(current);
      if (isExpanded) next.delete(parentCommentId);
      else next.add(parentCommentId);
      return next;
    });

    if (!isExpanded && !replyPages[parentCommentId]?.loaded) {
      await fetchReplies(parentCommentId);
    }
  }

  function beginReply(parent: Comment) {
    setReplyingTo(parent);
    setActionError(null);
    requestAnimationFrame(() => commentInputRef.current?.focus());
  }

  async function handleReaction(
    target: Comment,
    reaction: CommentReaction,
    parentCommentId?: string
  ) {
    if (!profile || !post) return;

    const key = `${parentCommentId ?? 'comment'}:${target.id}`;
    if (reactingKey === key) return;

    setActionError(null);
    setReactingKey(key);
    try {
      const selectedReaction = await toggleCommentReaction(
        post.id,
        target.id,
        profile.uid,
        reaction,
        parentCommentId
      );
      const nextTarget = withSelectedReaction(target, profile.uid, selectedReaction);

      if (parentCommentId) {
        setReplyPages((current) => {
          const page = current[parentCommentId];
          if (!page) return current;
          return {
            ...current,
            [parentCommentId]: {
              ...page,
              comments: page.comments.map((item) => (item.id === target.id ? nextTarget : item)),
            },
          };
        });
      } else {
        setComments((current) =>
          current.map((item) => (item.id === target.id ? nextTarget : item))
        );
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setReactingKey(null);
    }
  }

  function beginCaptionEdit() {
    if (!post) return;
    setCaptionDraft(post.text);
    setEditingCaption(true);
    setActionError(null);
  }

  async function saveCaption() {
    if (!profile || !post || savingCaption) return;

    setActionError(null);
    setSavingCaption(true);
    try {
      const text = await editPostCaption(post.id, profile.uid, captionDraft);
      setPost((current) => (current ? { ...current, text } : current));
      setEditingCaption(false);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSavingCaption(false);
    }
  }

  async function handleComment() {
    if (!profile || !post || !comment.trim() || commenting) return;

    setActionError(null);
    setCommenting(true);
    try {
      if (replyingTo) {
        await addCommentReply(post.id, replyingTo.id, profile, comment);
        setExpandedReplyIds((current) => new Set(current).add(replyingTo.id));
        await fetchReplies(replyingTo.id);
        setComments((current) =>
          current.map((item) =>
            item.id === replyingTo.id ? { ...item, replyCount: item.replyCount + 1 } : item
          )
        );
        setPost((current) =>
          current ? { ...current, commentCount: (current.commentCount ?? 0) + 1 } : current
        );
        setReplyingTo(null);
      } else {
        await addComment(post.id, profile, comment);
        const commentPage = await listComments(post.id);
        setComments(commentPage.comments);
        setCommentCursor(commentPage.cursor);
        setHasMoreComments(commentPage.cursor !== null);
        setPost((current) =>
          current ? { ...current, commentCount: (current.commentCount ?? 0) + 1 } : current
        );
      }
      setComment('');
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

  function openAuthorActions() {
    if (deleting || savingCaption) return;

    Alert.alert('Post options', undefined, [
      { text: 'Edit caption', onPress: beginCaptionEdit },
      { text: 'Delete post', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
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
                onPress={openAuthorActions}
                disabled={deleting || savingCaption}
                accessibilityRole="button"
                accessibilityLabel="Post options"
                style={styles.deleteButton}>
                <Ionicons name="ellipsis-horizontal" size={sizes.iconLg} color={colors.ink} />
              </Pressable>
            ) : undefined
          }
        />

        {actionError ? <View style={styles.notice}><Notice tone="error" message={actionError} /></View> : null}

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const replyPage = replyPages[item.id];
            const repliesExpanded = expandedReplyIds.has(item.id);

            return (
              <View style={styles.commentThread}>
                <CommentRow
                  comment={item}
                  currentUserId={profile.uid}
                  reacting={reactingKey === `comment:${item.id}`}
                  onReply={() => beginReply(item)}
                  onReact={(reaction) => void handleReaction(item, reaction)}
                />

                {item.replyCount > 0 ? (
                  <Pressable
                    onPress={() => void toggleReplies(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${repliesExpanded ? 'Hide' : 'View'} replies to ${item.authorName}`}
                    style={({ pressed }) => [styles.repliesToggle, pressed && styles.pressed]}>
                    <Ionicons
                      name={repliesExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={sizes.iconSm}
                      color={colors.accent}
                    />
                    <Text style={styles.repliesToggleText}>
                      {repliesExpanded
                        ? 'Hide replies'
                        : `View ${item.replyCount} ${item.replyCount === 1 ? 'reply' : 'replies'}`}
                    </Text>
                  </Pressable>
                ) : null}

                {repliesExpanded ? (
                  <View style={styles.replyList}>
                    {replyPage?.loading ? <Text style={styles.replyLoading}>Loading replies...</Text> : null}
                    {replyPage?.comments.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        currentUserId={profile.uid}
                        isReply
                        reacting={reactingKey === `${item.id}:${reply.id}`}
                        onReact={(reaction) => void handleReaction(reply, reaction, item.id)}
                      />
                    ))}
                    {replyPage?.hasMore ? (
                      <Button
                        label="Load earlier replies"
                        variant="ghost"
                        loading={replyPage.loadingMore}
                        onPress={() => void fetchReplies(item.id, replyPage.cursor)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
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
              {editingCaption ? (
                <View style={styles.captionEditor}>
                  <Text style={styles.captionLabel}>Edit caption</Text>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder="Write a caption..."
                    placeholderTextColor={colors.inkMuted}
                    accessibilityLabel="Edit post caption"
                    autoCapitalize="sentences"
                    autoCorrect
                    multiline
                    maxLength={TEXT_LIMITS.post}
                    editable={!savingCaption}
                    style={styles.captionInput}
                  />
                  <Text style={styles.captionCount}>{captionDraft.length}/{TEXT_LIMITS.post}</Text>
                  <View style={styles.captionActions}>
                    <Button
                      label="Cancel"
                      variant="secondary"
                      disabled={savingCaption}
                      onPress={() => {
                        setEditingCaption(false);
                        setCaptionDraft(post.text);
                      }}
                      style={styles.captionAction}
                    />
                    <Button
                      label="Save"
                      icon="checkmark-outline"
                      loading={savingCaption}
                      disabled={!captionDraft.trim() || captionDraft.trim() === post.text}
                      onPress={() => void saveCaption()}
                      style={styles.captionAction}
                    />
                  </View>
                </View>
              ) : null}
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
          {replyingTo ? (
            <View style={styles.replyingTo}>
              <Text style={styles.replyingToText} numberOfLines={1}>
                Replying to {replyingTo.authorName}
              </Text>
              <Pressable
                onPress={() => setReplyingTo(null)}
                disabled={commenting}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                style={styles.cancelReply}>
                <Ionicons name="close" size={sizes.iconSm} color={colors.inkMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
          <TextInput
            ref={commentInputRef}
            value={comment}
            onChangeText={setComment}
            placeholder={replyingTo ? 'Write a reply...' : 'Write a comment...'}
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel={replyingTo ? 'Write a reply' : 'Write a comment'}
            autoCapitalize="sentences"
            autoCorrect
            multiline
            maxLength={TEXT_LIMITS.comment}
            editable={!commenting}
            style={styles.input}
          />
          <Button
            label={replyingTo ? 'Reply' : 'Post'}
            icon={replyingTo ? 'arrow-undo-outline' : 'send-outline'}
            onPress={() => void handleComment()}
            loading={commenting}
            disabled={!comment.trim()}
            style={styles.commentButton}
          />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function withSelectedReaction(
  comment: Comment,
  uid: string,
  selectedReaction: CommentReaction | null
): Comment {
  const reactions = {
    like: [...(comment.reactions?.like ?? [])],
    love: [...(comment.reactions?.love ?? [])],
    celebrate: [...(comment.reactions?.celebrate ?? [])],
  };

  for (const reaction of COMMENT_REACTIONS) {
    reactions[reaction.value] = reactions[reaction.value].filter((reactorId) => reactorId !== uid);
  }
  if (selectedReaction) reactions[selectedReaction] = [...reactions[selectedReaction], uid];

  return { ...comment, reactions };
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
  captionEditor: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  captionLabel: {
    ...type.label,
    color: colors.ink,
  },
  captionInput: {
    minHeight: sizes.control * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    color: colors.ink,
    ...type.body,
    textAlignVertical: 'top',
  },
  captionCount: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'right',
  },
  captionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  captionAction: {
    flex: 1,
  },
  commentsTitle: {
    ...type.h2,
    color: colors.ink,
  },
  commentThread: {
    gap: spacing.sm,
  },
  repliesToggle: {
    alignSelf: 'flex-start',
    minHeight: sizes.touchMin,
    marginLeft: sizes.avatarSm + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  repliesToggleText: {
    ...type.caption,
    color: colors.accent,
  },
  replyList: {
    gap: spacing.md,
  },
  replyLoading: {
    ...type.caption,
    color: colors.inkMuted,
    marginLeft: sizes.avatarSm + spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  composer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  replyingTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
  },
  replyingToText: {
    ...type.caption,
    color: colors.accent,
    flex: 1,
  },
  cancelReply: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
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
