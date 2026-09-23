import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';

export function EnrollmentCount({ count }: { count?: number }) {
  const available = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
    <Ionicons name="people-outline" size={16} color={colors.inkMuted} />
    <Text style={{ ...type.caption, color: colors.inkMuted }}>
      {!available ? 'Enrollment count pending' : count === 0 ? '0 enrolled' : `${count} ${count === 1 ? 'learner' : 'learners'} enrolled`}
    </Text>
  </View>;
}
