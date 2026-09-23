import { View, Text, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, type } from '@/constants/theme';

export function DeleteLessonButton({ count = 0, onPress, loading, retry = false, style }: {
  count?: number; onPress: () => void; loading: boolean; retry?: boolean; style?: ViewStyle;
}) {
  return <View style={style}>
    <Button label={loading ? 'Deleting...' : retry ? 'Retry Delete' : 'Delete'} variant="ghost"
      icon={retry || count === 0 ? 'trash-outline' : 'lock-closed-outline'}
      disabled={!retry && count !== 0} loading={loading} onPress={onPress} />
    {!retry && count > 0 ? <Text style={{ ...type.caption, color: colors.inkMuted }}>
      Cannot delete ? {count} {count === 1 ? 'learner is' : 'learners are'} enrolled.
    </Text> : null}
  </View>;
}
