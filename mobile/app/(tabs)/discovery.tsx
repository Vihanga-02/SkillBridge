import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonList } from '@/components/ui/Skeleton';
import { UserCard } from '@/components/user/UserCard';
import {
  CATEGORIES,
  LEVELS,
  LEVEL_LABELS,
  skillsInCategory,
  type Category,
  type Level,
  type SkillTag,
} from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import type { PageCursor } from '@/services/pagination';
import { searchUsers, type UserSort } from '@/services/userService';
import type { User } from '@/types';

const SORTS: { value: UserSort | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

export default function DiscoveryScreen() {
  const { profile } = useAuth();

  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [skillTag, setSkillTag] = useState<SkillTag | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [sort, setSort] = useState<UserSort | null>(null);

  const searchTerm = useDebounce(text.trim(), 350);
  const isNameSearch = searchTerm.length > 0;

  const fetchPage = useCallback(
    (cursor: PageCursor) => searchUsers({ text: searchTerm, skillTag, category, sort, cursor }),
    [searchTerm, skillTag, category, sort]
  );

  const { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore } =
    usePaginatedQuery<User>(fetchPage);

  /**
   * `level` lives inside `skillsOffered`, an array of objects, which Firestore
   * cannot query into — so it is applied here. Self is removed here too, because
   * an inequality on `uid` would conflict with the sort field's index.
   */
  const results = useMemo(
    () =>
      items.filter((user) => {
        if (user.uid === profile?.uid) return false;
        if (!level) return true;
        return user.skillsOffered.some((skill) => skill.level === level);
      }),
    [items, level, profile?.uid]
  );

  const hasFilters = isNameSearch || !!category || !!skillTag || !!level || !!sort;

  function clearFilters() {
    setText('');
    setCategory(null);
    setSkillTag(null);
    setLevel(null);
    setSort(null);
  }

  function selectCategory(next: Category | null) {
    setCategory(next);
    setSkillTag(null);
  }

  const categorySkills = category ? skillsInCategory(category) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Discover" />

      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={sizes.iconSm} color={colors.inkMuted} />
          <TextInput
            style={styles.searchInput}
            value={text}
            onChangeText={setText}
            placeholder="Search by name"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search people by name"
          />
          {text.length > 0 ? (
            <Pressable
              onPress={() => setText('')}
              hitSlop={spacing.md}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={sizes.iconSm} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Sort stays on screen — never buried in a horizontal scroll. */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort</Text>
          <View style={[styles.sortToggle, isNameSearch && styles.sortDisabled]}>
            {SORTS.map((option) => {
              const selected = sort === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSort(option.value)}
                  disabled={isNameSearch}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: isNameSearch }}
                  style={[styles.sortOption, selected && styles.sortOptionSelected]}>
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          <Chip size="sm" label="All" selected={!category} onPress={() => selectCategory(null)} />
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              size="sm"
              label={item}
              selected={category === item}
              onPress={() => selectCategory(category === item ? null : item)}
            />
          ))}
        </ScrollView>

        {categorySkills.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {categorySkills.map((skill) => (
              <Chip
                key={skill.tag}
                size="sm"
                label={skill.label}
                selected={skillTag === skill.tag}
                onPress={() => setSkillTag(skillTag === skill.tag ? null : skill.tag)}
              />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          <Chip size="sm" label="Any level" selected={!level} onPress={() => setLevel(null)} />
          {LEVELS.map((item) => (
            <Chip
              key={item}
              size="sm"
              label={LEVEL_LABELS[item]}
              selected={level === item}
              onPress={() => setLevel(level === item ? null : item)}
            />
          ))}
        </ScrollView>

        {hasFilters ? (
          <Pressable
            onPress={clearFilters}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            style={styles.clearRow}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        ) : null}

        {isNameSearch ? (
          <Text style={styles.hint}>
            Matches the start of a name — &quot;cha&quot; finds &quot;Chamath&quot;. Sorted by name
            while searching.
          </Text>
        ) : null}
      </View>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <UserCard user={item} onPress={() => router.push(`/user/${item.uid}`)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            // An empty list never fires `onEndReached`, so when the level filter
            // removes everything on this page the user needs a way to keep paging.
            hasMore ? (
              <EmptyState
                icon="search-outline"
                title="No matching results on this page"
                message="Everyone loaded so far was filtered out. Load the next page to keep looking."
                actionLabel="Load more"
                onAction={loadMore}
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title={hasFilters ? 'No matching results' : 'No members to show'}
                message={
                  hasFilters
                    ? 'Try a broader category, any level, or clear the filters.'
                    : 'As people join and list what they can teach, they appear here.'
                }
                actionLabel={hasFilters ? 'Clear filters' : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <LoadingState />
            ) : !hasMore && results.length > 0 ? (
              <Text style={styles.endOfList}>That&apos;s everyone for now.</Text>
            ) : null
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
  filters: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...type.label,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sortLabel: {
    ...type.caption,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  sortToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 2,
  },
  sortDisabled: {
    opacity: 0.5,
  },
  sortOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    borderRadius: radius.sm - 2,
  },
  sortOptionSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  sortOptionText: {
    ...type.caption,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  sortOptionTextSelected: {
    color: colors.ink,
  },
  filterRow: {
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
  clearRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  clearText: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '500',
  },
  hint: {
    ...type.caption,
    color: colors.inkMuted,
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  endOfList: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
