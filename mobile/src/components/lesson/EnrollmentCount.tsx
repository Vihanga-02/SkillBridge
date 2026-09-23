import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';

export function EnrollmentCount({ count = 0 }: { count?: number }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
    <Ionicons name="people-outline" size={16} color={colors.inkMuted} />
    <Text style={{ ...type.caption, color: colors.inkMuted }}>
      {count + ' enrolled'}
    </Text>
  </View>;
}
