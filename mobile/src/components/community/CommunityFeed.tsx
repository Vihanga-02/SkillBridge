import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/community/PostCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { PAGE_SIZE } from '@/constants/config';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listPosts, toggleLike } from '@/services/postService';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import type { PageCursor } from '@/services/pagination';
import type { Post, PostType } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type FeedFilter = PostType | null;

const FILTERS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: null },
  { label: 'Achievements', value: 'achievement' },
  { label: 'Tips', value: 'tip' },
  { label: 'Questions', value: 'question' },
];

/** The text-only community feed. Posts are paginated and can be filtered by type. */
export function CommunityFeed() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<FeedFilter>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasFocused = useRef(false);

  const fetchPage = useCallback(
    async (cursor: PageCursor) => {
      const page = await listPosts({ type: filter ?? undefined, pageSize: PAGE_SIZE.posts, cursor });
      return { items: page.posts, cursor: page.cursor };
    },
    [filter]
  );
  const { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore } =
    usePaginatedQuery<Post>(fetchPage);

  // A new post/detail screen returns to this mounted tab. Refresh then, but
  // avoid duplicating the initial request that `usePaginatedQuery` already made.
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) refresh();
      else hasFocused.current = true;
    }, [refresh])
  );

  async function handleToggleLike(postId: string) {
    if (!profile || likingId) return;

    setActionError(null);
    setLikingId(postId);
    try {
      await toggleLike(postId, profile.uid);
      refresh();
    } catch (likeError) {
      setActionError(errorMessage(likeError));
    } finally {
      setLikingId(null);
    }
  }

  if (!profile || loading) return <LoadingState label="Loading community posts…" />;

  return (
    <FlatList
      data={items}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          currentUserId={profile.uid}
          liking={likingId === item.id}
          onToggleLike={() => void handleToggleLike(item.id)}
          onOpen={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
          onOpenAuthor={() => router.push({ pathname: '/user/[id]', params: { id: item.authorId } })}
        />
      )}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshing={refreshing}
      onRefresh={refresh}
      onEndReached={() => loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          <Button
            label="Create post"
            icon="add-outline"
            onPress={() => router.push('/post/create')}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((option) => (
              <Chip
                key={option.label}
                size="sm"
                label={option.label}
                selected={filter === option.value}
                onPress={() => setFilter(option.value)}
              />
            ))}
          </ScrollView>

          {actionError ? <Notice tone="error" message={actionError} /> : null}
          {error && items.length > 0 ? <Notice tone="error" message={error} /> : null}
        </View>
      }
      ListEmptyComponent={
        error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <EmptyState
            icon="newspaper-outline"
            title="No posts yet"
            message="Be the first to share a tip, question or achievement."
            actionLabel="Create post"
            onAction={() => router.push('/post/create')}
          />
        )
      }
      ListFooterComponent={
        hasMore ? (
          <Button
            label="Load more"
            variant="secondary"
            loading={loadingMore}
            onPress={loadMore}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.md,
  },
  filters: {
    gap: spacing.sm,
  },
});
