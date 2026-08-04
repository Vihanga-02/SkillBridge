import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';

/**
 * [M4] Placeholder from the Week 1 app shell. Member 4 replaces this with the
 * Feed / Chats tabs, post composer, chat threads and reviews.
 */
export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Community" subtitle="Ask, share and message the people you learn with." />
        <View style={styles.body}>
          <EmptyState
            icon="chatbubbles-outline"
            title="Chat and the feed land here"
            message="Member 4 builds messaging, the community feed and reviews on top of this shell"
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
