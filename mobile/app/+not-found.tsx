import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.wrapper}>
      <EmptyState
        icon="compass-outline"
        title="This screen doesn't exist"
        message="The link you followed points somewhere SkillBridge doesn't have a page for."
        actionLabel="Go home"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
});
