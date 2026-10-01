import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Message } from '@/types';
import { toDate } from '@/utils/date';

type Props = {
  message: Message;
  isMine: boolean;
  onImagePress?: (imageUrl: string, senderName: string) => void;
};

/** One accessible, wrapping message bubble for the real-time direct-chat thread. */
export function MessageBubble({ message, isMine, onImagePress }: Props) {
  const time = formatMessageTime(message.createdAt);
  const sender = isMine ? 'You' : message.senderName;
  const contentDescription = message.text || (message.imageUrl ? 'Photo' : 'Message');

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View
        accessibilityLabel={`${sender}, ${time}: ${contentDescription}`}
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine ? <Text style={styles.sender}>{message.senderName}</Text> : null}
        {message.imageUrl ? (
          <Pressable
            onPress={() => onImagePress?.(message.imageUrl!, isMine ? 'You' : message.senderName)}
            disabled={!onImagePress}
            accessibilityRole="button"
            accessibilityLabel={`Open ${sender}'s attached photo`}
            accessibilityHint="Opens the photo full screen"
            style={({ pressed }) => [styles.imageButton, pressed && styles.imagePressed]}>
            <Image
              source={{ uri: message.imageUrl }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              style={styles.image}
            />
            <View pointerEvents="none" style={styles.expandBadge}>
              <Ionicons name="expand-outline" size={sizes.iconSm} color={colors.inkInverse} />
            </View>
          </Pressable>
        ) : null}
        {message.text ? (
          <Text style={[styles.text, isMine ? styles.textMine : styles.textOther]}>{message.text}</Text>
        ) : null}
        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>{time}</Text>
      </View>
    </View>
  );
}

function formatMessageTime(value: Message['createdAt']): string {
  const date = toDate(value);
  return date ? format(date, 'h:mm a') : 'Sendingâ€¦';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
  },
  sender: {
    ...type.label,
    color: colors.accent,
  },
  text: {
    ...type.body,
  },
  textMine: {
    color: colors.inkInverse,
  },
  textOther: {
    color: colors.ink,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  imageButton: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  imagePressed: {
    opacity: 0.82,
  },
  expandBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  time: {
    ...type.caption,
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: colors.inkInverseMuted,
  },
  timeOther: {
    color: colors.inkMuted,
  },
});
