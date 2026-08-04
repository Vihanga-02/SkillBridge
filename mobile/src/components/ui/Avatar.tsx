import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, type } from '@/constants/theme';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  name: string;
  uri?: string;
  size?: Size;
};

const DIMENSION: Record<Size, number> = {
  sm: sizes.avatarSm,
  md: sizes.avatarMd,
  lg: sizes.avatarLg,
};

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Circle image with an initials fallback, so a missing avatar never looks broken. */
export function Avatar({ name, uri, size = 'md' }: Props) {
  const dimension = DIMENSION[size];
  const box = { width: dimension, height: dimension, borderRadius: radius.full };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, box]}
        contentFit="cover"
        accessibilityLabel={`${name}'s profile picture`}
      />
    );
  }

  return (
    <View style={[styles.fallback, box]} accessibilityLabel={name}>
      <Text style={[styles.initials, size === 'lg' && styles.initialsLarge]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceAlt,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSurface,
  },
  initials: {
    ...type.label,
    color: colors.accent,
  },
  initialsLarge: {
    ...type.h1,
    color: colors.accent,
  },
});
