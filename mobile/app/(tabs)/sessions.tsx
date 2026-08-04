import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';

/**
 * [M3] Placeholder from the Week 1 app shell. Member 3 replaces this with the
 * Browse / My Sessions tabs, session cards and the booking request flow.
 */
export default function SessionsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Sessions" subtitle="Book time with a peer, or offer some of yours." />
        <View style={styles.body}>
          <EmptyState
            icon="calendar-outline"
            title="Peer sessions land here"
            message="Member 3 builds session listings, the calendar and the booking transaction on top of this shell"
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
