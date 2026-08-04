import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';

/**
 * [M2] Placeholder from the Week 1 app shell. Member 2 replaces this with the
 * lesson feed: category and level filters, LessonCards, pull-to-refresh, paging.
 */
export default function FeedScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Learn" subtitle="Five to fifteen minute lessons from your peers." />
        <View style={styles.body}>
          <EmptyState
            icon="book-outline"
            title="Micro-lessons land here"
            message="Member 2 builds the lesson feed, viewer and quizzes on top of this shell"
          />
        </View>
      </ScrollView>
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
    paddingTop: spacing.lg,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
});
