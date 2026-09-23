import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ReviewCard } from '@/components/community/ReviewCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { PAGE_SIZE } from '@/constants/config';
import { colors, spacing, type } from '@/constants/theme';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import type { PageCursor } from '@/services/pagination';
import { getReviewsForUser } from '@/services/reviewService';
import type { Review } from '@/types';

type Props = {
  userId: string;
};

/** Public, paginated review section for a member profile. */
export function UserReviews({ userId }: Props) {
  const hasFocused = useRef(false);
  const fetchPage = useCallback(
    async (cursor: PageCursor) => {
      const page = await getReviewsForUser(userId, { pageSize: PAGE_SIZE.reviews, cursor });
      return { items: page.reviews, cursor: page.cursor };
    },
    [userId]
  );
  const { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore } =
    usePaginatedQuery<Review>(fetchPage);

  // A review is usually submitted from a child route. Refresh when that route
  // closes, but avoid a duplicate initial request from usePaginatedQuery.
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) refresh();
      else hasFocused.current = true;
    }, [refresh])
  );

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Reviews</Text>

      {loading ? (
        <LoadingState label="Loading reviews…" />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="star-outline"
          title="No reviews yet"
          message="Reviews from completed sessions will appear here."
        />
      ) : (
        <View style={styles.list}>
          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {error ? <Notice tone="error" message={error} /> : null}
          {hasMore ? (
            <Button
              label="Load older reviews"
              variant="secondary"
              loading={loadingMore}
              onPress={loadMore}
            />
          ) : null}
        </View>
      )}

      {refreshing ? <Text style={styles.refreshing}>Refreshing reviews…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    ...type.h1,
    color: colors.ink,
  },
  list: {
    gap: spacing.md,
  },
  refreshing: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
