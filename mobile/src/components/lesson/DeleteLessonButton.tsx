import { View, Text, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useLessonEnrollmentCount } from '@/hooks/useLessonEnrollmentCount';
import { colors, type } from '@/constants/theme';

export function DeleteLessonButton({ lessonId, onPress, loading, style }: {
  lessonId: string; onPress: () => void; loading: boolean; style?: ViewStyle;
}) {
  const { count, error } = useLessonEnrollmentCount(lessonId);
  return <View style={style}>
    <Button label="Delete" variant="ghost" icon={count === 0 ? 'trash-outline' : 'lock-closed-outline'}
      disabled={count !== 0 || error} loading={loading} onPress={onPress} />
    {count !== null && count > 0 ? <Text style={{ ...type.caption, color: colors.inkMuted }}>
      Cannot delete ? {count} {count === 1 ? 'learner is' : 'learners are'} enrolled.
    </Text> : null}
  </View>;
}
