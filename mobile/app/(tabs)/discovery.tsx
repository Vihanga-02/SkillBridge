import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { DiscoverHero } from '@/components/discovery/DiscoverHero';
import {
  FilterSheet,
  ROLE_FILTERS,
  type BrowseMode,
  type RoleFilter,
} from '@/components/discovery/FilterSheet';
import { PeopleCarousel } from '@/components/discovery/PeopleCarousel';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { UserCard } from '@/components/user/UserCard';
import { goalLabel, type CareerGoalTag } from '@/constants/careerGoals';
import { PAGE_SIZE } from '@/constants/config';
import {
  CATEGORIES,
  LEVEL_LABELS,
  skillLabel,
  type Category,
  type Level,
  type SkillTag,
} from '@/constants/skills';
import { brand, colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import type { PageCursor } from '@/services/pagination';
import { searchUsers } from '@/services/userService';
import type { User } from '@/types';
import { rankInBatches, type PeerMatch } from '@/utils/peerMatch';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICON: Record<Category, { name: IconName; color: string }> = {
  Programming: { name: 'code-slash', color: brand.blue },
  Design: { name: 'color-palette', color: brand.green },
  Business: { name: 'briefcase', color: colors.accent },
  Academic: { name: 'school', color: brand.navy },
};

/** Cards past this index appear without a stagger, so long lists never lag. */
const STAGGERED_CARDS = 8;
const TOP_RATED_COUNT = 5;

type Row = { user: User; match?: PeerMatch };

export default function DiscoveryScreen() {
  const { profile } = useAuth();
  const isFocused = useIsFocused();

  const [text, setText] = useState('');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('category');
  const [category, setCategory] = useState<Category | null>(null);
  const [skillTag, setSkillTag] = useState<SkillTag | null>(null);
  const [careerGoal, setCareerGoal] = useState<CareerGoalTag | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchTerm = useDebounce(text.trim(), 350);
  const isNameSearch = searchTerm.length > 0;

  const fetchPage = useCallback(
    (cursor: PageCursor) =>
      searchUsers({
        text: searchTerm,
        skillTag,
        category: browseMode === 'category' ? category : null,
        careerGoal: browseMode === 'goal' ? careerGoal : null,
        cursor,
      }),
    [searchTerm, skillTag, category, careerGoal, browseMode]
  );

  const { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore } =
    usePaginatedQuery<User>(fetchPage);

  /**
   * Learners (and "both") see the peers who teach what they want first. A name
   * search keeps its alphabetical order, and teachers keep the default order.
   */
  const rankFor =
    profile && profile.role !== 'teacher' && !isNameSearch && profile.skillTagsWanted.length > 0
      ? profile
      : null;

  /**
   * `level` lives inside `skillsOffered`, an array of objects, which Firestore
   * cannot query into — so it is applied here. Role filter is applied here too
   * so it composes with skill/category queries without needing composite indexes.
   * Self is removed here as well, because an inequality on `uid` would conflict
   * with other query fields. Ranking runs first, on whole pages, so the page
   * boundaries it relies on are still intact.
   */
  const results = useMemo<Row[]>(() => {
    const rows: Row[] = rankFor
      ? rankInBatches(items, rankFor, PAGE_SIZE.discovery)
      : items.map((user) => ({ user }));

    return rows.filter(({ user }) => {
      if (user.uid === profile?.uid) return false;
      if (roleFilter === 'teachers' && user.role === 'learner') return false;
      if (roleFilter === 'learners' && user.role === 'teacher') return false;
      if (!level) return true;
      return user.skillsOffered.some((skill) => skill.level === level);
    });
  }, [items, rankFor, level, roleFilter, profile?.uid]);

  const topRated = useMemo(
    () =>
      items
        .filter((user) => user.uid !== profile?.uid && user.ratingCount > 0)
        .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
        .slice(0, TOP_RATED_COUNT),
    [items, profile?.uid]
  );

  const filterCount =
    (category || careerGoal ? 1 : 0) + (skillTag ? 1 : 0) + (level ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0);
  const hasFilters = isNameSearch || filterCount > 0;

  function clearFilters() {
    setText('');
    setBrowseMode('category');
    setCategory(null);
    setSkillTag(null);
    setCareerGoal(null);
    setLevel(null);
    setRoleFilter('all');
  }

  function switchBrowseMode(next: BrowseMode) {
    setBrowseMode(next);
    setCategory(null);
    setCareerGoal(null);
    setSkillTag(null);
  }

  function selectCategory(next: Category | null) {
    setCategory(next);
    setSkillTag(null);
  }

  function selectCareerGoal(next: CareerGoalTag | null) {
    setCareerGoal(next);
    setSkillTag(null);
  }

  /** The on-screen category row always browses by category. */
  function quickCategory(next: Category | null) {
    if (browseMode !== 'category') switchBrowseMode('category');
    selectCategory(next);
  }

  const roleLabel = ROLE_FILTERS.find((option) => option.value === roleFilter)?.label;

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [
    ...(roleFilter !== 'all' && roleLabel
      ? [{ key: 'role', label: roleLabel, onRemove: () => setRoleFilter('all') }]
      : []),
    ...(careerGoal
      ? [{ key: 'goal', label: goalLabel(careerGoal), onRemove: () => selectCareerGoal(null) }]
      : []),
    ...(skillTag
      ? [{ key: 'skill', label: skillLabel(skillTag), onRemove: () => setSkillTag(null) }]
      : []),
    ...(level ? [{ key: 'level', label: LEVEL_LABELS[level], onRemove: () => setLevel(null) }] : []),
  ];

  const showHighlights = !hasFilters && topRated.length > 0;

  const listHeader = (
    <View style={styles.listHeader}>
      {showHighlights ? (
        <PeopleCarousel
          title="Top rated"
          icon="trophy-outline"
          users={topRated}
          onPressUser={(user) => router.push(`/user/${user.uid}`)}
        />
      ) : null}
      {results.length > 0 ? (
        <Text style={styles.sectionTitle}>
          {hasFilters ? 'Results' : rankFor ? 'Best matches for you' : 'Everyone'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      {isFocused ? <StatusBar style="light" /> : null}

      <DiscoverHero
        name={profile?.name ?? ''}
        avatarUrl={profile?.avatarUrl}
        search={text}
        onSearchChange={setText}
        filterCount={filterCount}
        onOpenFilters={() => setFiltersOpen(true)}
        onPressAvatar={() => router.push('/(tabs)/me')}
      />

      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          <Chip
            label="All"
            icon="apps"
            selected={!category && !careerGoal}
            onPress={() => quickCategory(null)}
          />
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              icon={CATEGORY_ICON[item].name}
              iconColor={CATEGORY_ICON[item].color}
              selected={browseMode === 'category' && category === item}
              onPress={() => quickCategory(category === item ? null : item)}
              showCheck={false}
            />
          ))}
        </ScrollView>

        {activeFilters.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {activeFilters.map((filter) => (
              <Chip
                key={filter.key}
                size="sm"
                icon="close"
                label={filter.label}
                selected
                onPress={filter.onRemove}
              />
            ))}
            <Chip size="sm" label="Clear all" onPress={clearFilters} />
          </ScrollView>
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
          keyExtractor={(row) => row.user.uid}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={
                index < STAGGERED_CARDS
                  ? FadeInDown.delay(index * 40)
                      .duration(320)
                      .reduceMotion(ReduceMotion.System)
                  : FadeIn.duration(200).reduceMotion(ReduceMotion.System)
              }>
              <UserCard
                user={item.user}
                match={item.match}
                onPress={() => router.push(`/user/${item.user.uid}`)}
              />
            </Animated.View>
          )}
          ListHeaderComponent={listHeader}
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
                iconColor={brand.blue}
                title="Nobody on this page matches"
                message="Everyone loaded so far was filtered out. Load more people to keep looking."
                actionLabel="Load more"
                onAction={loadMore}
              />
            ) : (
              <EmptyState
                icon={hasFilters ? 'search-outline' : 'people-outline'}
                iconColor={brand.blue}
                title={hasFilters ? 'No one fits those filters yet' : 'Be one of the first here'}
                message={
                  hasFilters
                    ? 'Try a broader category or any level — or clear the filters to see everyone.'
                    : 'As people join and share what they can teach, they will show up here.'
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

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClearAll={clearFilters}
        roleFilter={roleFilter}
        onRoleFilter={setRoleFilter}
        browseMode={browseMode}
        onBrowseMode={switchBrowseMode}
        category={category}
        onCategory={selectCategory}
        careerGoal={careerGoal}
        onCareerGoal={selectCareerGoal}
        skillTag={skillTag}
        onSkillTag={setSkillTag}
        level={level}
        onLevel={setLevel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filters: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...type.caption,
    color: colors.inkMuted,
    paddingHorizontal: spacing.lg,
  },
  listHeader: {
    gap: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.ink,
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
