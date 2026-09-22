import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';
import { useLessonEnrollmentCount } from '@/hooks/useLessonEnrollmentCount';

export function EnrollmentCount({ lessonId }: { lessonId: string }) {
  const { count, error } = useLessonEnrollmentCount(lessonId);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
    <Ionicons name="people-outline" size={16} color={colors.inkMuted} />
    <Text style={{ ...type.caption, color: colors.inkMuted }}>
      {error ? 'Enrollment count unavailable' : count === null ? 'Loading enrollments?' : count + ' enrolled'}
    </Text>
  </View>;
}
