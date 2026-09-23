import { View, Text, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, type } from '@/constants/theme';

export function DeleteLessonButton({ count, deleting = false, onPress, loading, style }: {
  count?: number; deleting?: boolean; onPress: () => void; loading: boolean; style?: ViewStyle;
}) {
  const available = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  return <View style={style}>
    <Button label={deleting ? 'Retry deletion' : 'Delete'} variant="ghost" icon={count === 0 ? 'trash-outline' : 'lock-closed-outline'}
      disabled={!available || count !== 0} loading={loading} onPress={onPress} />
    {!available ? <Text style={{ ...type.caption, color: colors.inkMuted }}>
      Enrollment count must be verified before deletion.
    </Text> : count !== undefined && count > 0 ? <Text style={{ ...type.caption, color: colors.inkMuted }}>
      Cannot delete: {count} {count === 1 ? 'learner is' : 'learners are'} enrolled.
    </Text> : null}
  </View>;
}
