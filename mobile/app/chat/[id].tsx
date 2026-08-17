import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';

/**
 * SCRUM-76 destination route. The thread is already created before this screen
 * opens; SCRUM-78 replaces this ready state with the real-time message list and
 * composer.
 */
export default function ChatThreadScreen() {
  const { participantName } = useLocalSearchParams<{ id: string; participantName?: string }>();
  const title = participantName ? `Chat with ${participantName}` : 'Chat';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} showBack />
      <View style={styles.content}>
        <EmptyState
          icon="chatbubbles-outline"
          title="Conversation ready"
          message="Your direct chat has been opened. Real-time messaging will be available here next."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
