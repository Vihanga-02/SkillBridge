import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';

export function EnrollmentCount({ count = 0 }: { count?: number }) {
  const safeCount = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Ionicons name="people-outline" size={16} color={colors.inkMuted} />
      <Text style={{ ...type.caption, color: colors.inkMuted }}>
        {safeCount === 0 ? '0 enrolled' : `${safeCount} ${safeCount === 1 ? 'learner' : 'learners'} enrolled`}
      </Text>
    </View>
  );
}
