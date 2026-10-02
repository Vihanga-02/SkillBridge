import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type ViewerImage = {
  url: string;
  senderName: string;
};

type Props = {
  image: ViewerImage | null;
  onClose: () => void;
};

/** Full-screen, accessible photo viewer for images sent in a direct chat. */
export function ChatImageViewer({ image, onClose }: Props) {
  return (
    <Modal
      visible={image !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {image ? (image.senderName === 'You' ? 'Your photo' : `${image.senderName}'s photo`) : 'Photo'}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              hitSlop={spacing.sm}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
              <Ionicons name="close" size={sizes.iconLg} color={colors.inkInverse} />
            </Pressable>
          </View>

          <View style={styles.imageArea}>
            {image ? (
              <Image
                source={{ uri: image.url }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
                accessibilityLabel={
                  image.senderName === 'You'
                    ? 'Your photo, expanded'
                    : `${image.senderName}'s photo, expanded`
                }
                style={styles.image}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    ...type.bodyStrong,
    color: colors.inkInverse,
    flex: 1,
    marginRight: spacing.md,
  },
  closeButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  imageArea: {
    flex: 1,
    padding: spacing.lg,
  },
  image: {
    flex: 1,
    width: '100%',
  },
});
