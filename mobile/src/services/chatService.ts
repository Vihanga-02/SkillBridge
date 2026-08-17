/**
 * A direct-chat ID is derived from the two participant UIDs, rather than from
 * Firestore's random ID generator. That gives a pair of users exactly one
 * possible thread, no matter which participant opens it first.
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '@/firebase/config';
import type { ChatParticipant, User } from '@/types';
import { createChatId } from '@/utils/chat';

export { createChatId } from '@/utils/chat';

// The profile fields needed to create the participant map on a new chat.
export type DirectChatUser = Pick<User, 'uid' | 'name' | 'avatarUrl'>;

const toParticipant = (user: DirectChatUser): ChatParticipant => ({
  name: user.name,
  avatarUrl: user.avatarUrl,
});

/**
 * Creates the one permitted direct-chat document for this pair when necessary,
 * then returns its deterministic ID. A Firestore transaction prevents repeated
 * taps or two simultaneous clients from resetting an existing thread.
 */
export async function ensureDirectChat(
  currentUser: DirectChatUser,
  otherUser: DirectChatUser
): Promise<string> {
  if (currentUser.uid === otherUser.uid) {
    throw new Error('You cannot start a direct chat with yourself.');
  }

  const chatId = createChatId(currentUser.uid, otherUser.uid);
  const participantIds = [currentUser.uid, otherUser.uid].sort();
  const chatRef = doc(db, 'chats', chatId);

  await runTransaction(db, async (transaction) => {
    const existingChat = await transaction.get(chatRef);

    // Do not overwrite an existing last message, unread counts, or timestamp.
    if (existingChat.exists()) return;

    transaction.set(chatRef, {
      participantIds,
      participants: {
        [currentUser.uid]: toParticipant(currentUser),
        [otherUser.uid]: toParticipant(otherUser),
      },
      lastMessage: '',
      lastSenderId: '',
      lastMessageAt: null,
      unreadCount: {
        [currentUser.uid]: 0,
        [otherUser.uid]: 0,
      },
      createdAt: serverTimestamp(),
    });
  });

  return chatId;
}
