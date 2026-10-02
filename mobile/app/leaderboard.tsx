import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeaderboardRow } from '@/components/community/LeaderboardRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { LEADERBOARD_LIMIT, subscribeToLeaderboard } from '@/services/leaderboardService';
import type { CommunityStats } from '@/types';
import { errorMessage } from '@/utils/authErrors';

/** Live, all-time ranking of members who create useful community activity. */
export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<CommunityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    return subscribeToLeaderboard(
      (nextEntries) => {
        setEntries(nextEntries);
        setLoading(false);
      },
      (nextError) => {
        setError(errorMessage(nextError));
        setLoading(false);
      }
    );
  }, [retryKey]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Leaderboard" subtitle="Top community contributors" showBack />

      {loading ? (
        <LoadingState label="Loading leaderboard…" />
      ) : error && entries.length === 0 ? (
        <ErrorState message={error} onRetry={() => setRetryKey((current) => current + 1)} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.userId}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              entry={item}
              rank={index + 1}
              currentUserId={profile?.uid ?? ''}
              onOpenProfile={() => router.push({ pathname: '/user/[id]', params: { id: item.userId } })}
            />
          )}
          ListHeaderComponent={
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Ionicons name="trophy-outline" size={sizes.iconLg} color={colors.accent} />
              </View>
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>All-time rankings</Text>
                <Text style={styles.introText}>
                  Earn points by sharing posts, comments and helpful replies.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title="No contributors yet"
              message="Share the first post and start the community leaderboard."
              actionLabel="Create post"
              onAction={() => router.push('/post/create')}
            />
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {error ? <Notice tone="error" message={error} /> : null}
              {entries.length > 0 ? (
                <Text style={styles.footerText}>Showing the top {Math.min(entries.length, LEADERBOARD_LIMIT)} contributors</Text>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
  },
  introIcon: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  introCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  introTitle: {
    ...type.h2,
    color: colors.ink,
  },
  introText: {
    ...type.caption,
    color: colors.inkMuted,
  },
  footer: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  footerText: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
