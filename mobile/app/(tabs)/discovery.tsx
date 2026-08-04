import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';

/**
 * [M1] Placeholder from the Week 1 app shell. Member 1 replaces this with the
 * search bar, category chips, difficulty filter and the FlatList of UserCards.
 */
export default function DiscoveryScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Discover" subtitle="Find a peer who can teach what you want to learn." />
        <View style={styles.body}>
          <EmptyState
            icon="search-outline"
            title="Discovery lands here"
            message="Member 1 builds search, category chips and peer cards on top of this shell"
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
