import { View, Text, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, type } from '@/constants/theme';

export function DeleteLessonButton({ count = 0, deleting = false, onPress, loading, style }: {
  count?: number; deleting?: boolean; onPress: () => void; loading: boolean; style?: ViewStyle;
}) {
  const safeCount = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : 0;
  const canDelete = safeCount === 0;
  return (
    <View style={style}>
      <Button
        label={deleting ? 'Retry deletion' : 'Delete'}
        variant="ghost"
        icon={canDelete ? 'trash-outline' : 'lock-closed-outline'}
        disabled={!canDelete}
        loading={loading}
        onPress={onPress}
      />
      {safeCount > 0 ? (
        <Text style={{ ...type.caption, color: colors.inkMuted }}>
          Cannot delete: {safeCount} {safeCount === 1 ? 'learner is' : 'learners are'} enrolled.
        </Text>
      ) : null}
    </View>
  );
}
