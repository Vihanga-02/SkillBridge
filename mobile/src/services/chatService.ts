/**
 * A direct-chat ID is derived from the two participant UIDs, rather than from
 * Firestore's random ID generator. That gives a pair of users exactly one
 * possible thread, no matter which participant opens it first.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import type { Chat, ChatParticipant, Message, User } from '@/types';
import { createChatId } from '@/utils/chat';

export { createChatId } from '@/utils/chat';

// The profile fields needed to create the participant map on a new chat.
export type DirectChatUser = Pick<User, 'uid' | 'name' | 'avatarUrl'>;

const toParticipant = (user: DirectChatUser): ChatParticipant => ({
  name: user.name,
  avatarUrl: user.avatarUrl,
});

const toChat = (data: DocumentData, id: string): Chat => ({ ...data, id }) as Chat;

const toMessage = (snapshot: QueryDocumentSnapshot<DocumentData>): Message =>
  ({ ...snapshot.data(), id: snapshot.id }) as Message;

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

/** Live chat metadata, including the other participant's display information. */
export function subscribeToChat(
  chatId: string,
  onNext: (chat: Chat | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'chats', chatId),
    (snapshot) => onNext(snapshot.exists() ? toChat(snapshot.data(), snapshot.id) : null),
    (error) => onError?.(error)
  );
}

/**
 * Streams a thread in chronological order. The returned unsubscribe function
 * must be returned from the screen's useEffect cleanup.
 */
export function subscribeToMessages(
  chatId: string,
  onNext: (messages: Message[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => onNext(snapshot.docs.map(toMessage)),
    (error) => onError?.(error)
  );
}

/**
 * Persists one message and the parent chat preview together. The transaction
 * also rejects a stale/deep-linked chat and prevents a non-participant from
 * writing to the thread before the Firestore rules make the same guarantee.
 */
export async function sendMessage(
  chatId: string,
  sender: DirectChatUser,
  rawText: string
): Promise<void> {
  const text = rawText.trim();
  if (!text) {
    throw new Error('Type a message before sending.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const messageRef = doc(collection(chatRef, 'messages'));

  await runTransaction(db, async (transaction) => {
    const chatSnapshot = await transaction.get(chatRef);
    if (!chatSnapshot.exists()) {
      throw new Error('This conversation is no longer available.');
    }

    const chat = toChat(chatSnapshot.data(), chatSnapshot.id);
    if (!chat.participantIds.includes(sender.uid)) {
      throw new Error('You cannot send a message in this conversation.');
    }

    const unreadCount = Object.fromEntries(
      chat.participantIds.map((participantId) => [
        participantId,
        participantId === sender.uid ? 0 : (chat.unreadCount?.[participantId] ?? 0) + 1,
      ])
    );

    transaction.set(messageRef, {
      senderId: sender.uid,
      senderName: sender.name,
      text,
      moderation: 'clean',
      createdAt: serverTimestamp(),
    });
    transaction.update(chatRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastSenderId: sender.uid,
      unreadCount,
    });
  });
}
