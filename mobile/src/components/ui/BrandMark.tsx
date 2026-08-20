import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { sizes, spacing } from '@/constants/theme';

type Props = {
  variant?: 'login' | 'splash';
};

/** The wordmark used on the auth screens and the splash gate. */
export function BrandMark({ variant = 'login' }: Props) {
  const isSplash = variant === 'splash';

  return (
    <View style={styles.wrapper}>
      <Image
        source={
          isSplash
            ? require('../../../assets/images/splash-logo.png')
            : require('../../../assets/images/logo.png')
        }
        style={isSplash ? styles.splashLogo : styles.loginLogo}
        contentFit="contain"
        accessibilityLabel={
          isSplash ? 'SkillBridge' : 'SkillBridge — Learn, Share, Grow Together'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  loginLogo: {
    width: sizes.preview - spacing.xxl * 4,
    maxWidth: '100%',
    aspectRatio: 1.5,
  },
  splashLogo: {
    width: sizes.preview,
    maxWidth: '100%',
    aspectRatio: 1536 / 900,
  },
});
