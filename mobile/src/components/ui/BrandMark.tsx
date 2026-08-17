import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { sizes } from '@/constants/theme';

/** The wordmark used on the auth screens and the splash gate. */
export function BrandMark() {
  return (
    <View style={styles.wrapper}>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="SkillBridge — Learn, Share, Grow Together"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: sizes.preview,
    maxWidth: '100%',
    aspectRatio: 1.5,
  },
});
