import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, type } from '@/constants/theme';
import { formatRating } from '@/utils/format';

type DisplayProps = {
  mode?: 'display';
  rating: number;
  count?: number;
  /** Hides the numeric value, leaving just the stars. */
  hideValue?: boolean;
};

type InputProps = {
  mode: 'input';
  rating: number;
  onChange: (rating: number) => void;
};

type Props = DisplayProps | InputProps;

const STARS = [1, 2, 3, 4, 5];

export function RatingStars(props: Props) {
  if (props.mode === 'input') {
    return (
      <View style={styles.row} accessibilityRole="radiogroup">
        {STARS.map((star) => (
          <Pressable
            key={star}
            onPress={() => props.onChange(star)}
            hitSlop={spacing.sm}
            accessibilityRole="radio"
            accessibilityState={{ selected: props.rating >= star }}
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
            style={styles.inputStar}>
            <Ionicons
              name={props.rating >= star ? 'star' : 'star-outline'}
              size={sizes.iconLg}
              color={props.rating >= star ? colors.accent : colors.inkFaint}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  const { rating, count = 0, hideValue = false } = props;
  const label = count > 0 ? `${rating.toFixed(1)} out of 5 from ${count} reviews` : 'Not yet rated';

  return (
    <View style={styles.row} accessibilityLabel={label}>
      {STARS.map((star) => (
        <Ionicons
          key={star}
          name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'}
          size={sizes.iconSm}
          color={count > 0 ? colors.accent : colors.inkFaint}
        />
      ))}
      {hideValue ? null : (
        <Text style={styles.value}>
          {formatRating(rating, count)}
          {count > 0 ? ` (${count})` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inputStar: {
    padding: spacing.xs,
  },
  value: {
    ...type.caption,
    color: colors.inkMuted,
    marginLeft: spacing.xs,
  },
});
