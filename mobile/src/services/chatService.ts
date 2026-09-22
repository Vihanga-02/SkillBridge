/**
 * A direct-chat ID is derived from the two participant UIDs, rather than from
 * Firestore's random ID generator. That gives a pair of users exactly one
 * possible thread, no matter which participant opens it first.
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import { PAGE_SIZE } from '@/constants/config';
import type { Chat, ChatParticipant, Message, User } from '@/types';
import { createChatId } from '@/utils/chat';

export { createChatId } from '@/utils/chat';

// The profile fields needed to create the participant map on a new chat.
export type DirectChatUser = Pick<User, 'uid' | 'name' | 'avatarUrl'>;

const toParticipant = (user: DirectChatUser): ChatParticipant => ({
  name: user.name,
  avatarUrl: user.avatarUrl,
});

const sameParticipant = (value: unknown, participant: ChatParticipant): boolean => {
  if (!value || typeof value !== 'object') return false;

  const stored = value as Partial<ChatParticipant>;
  return stored.name === participant.name && stored.avatarUrl === participant.avatarUrl;
};

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
    if (existingChat.exists()) {
      const storedParticipants = existingChat.data().participants;
      const participants =
        storedParticipants && typeof storedParticipants === 'object' ? storedParticipants : {};
      const currentParticipant = toParticipant(currentUser);
      const otherParticipant = toParticipant(otherUser);

      if (
        !sameParticipant(participants[currentUser.uid], currentParticipant) ||
        !sameParticipant(participants[otherUser.uid], otherParticipant)
      ) {
        transaction.update(chatRef, {
          participants: {
            ...participants,
            [currentUser.uid]: currentParticipant,
            [otherUser.uid]: otherParticipant,
          },
        });
      }
      return;
    }

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
 * Streams the signed-in user's conversations in the same order users expect
 * from a messaging inbox: most recently active first. This query needs the
 * `participantIds (array-contains) + lastMessageAt desc` composite index.
 */
export function subscribeToMyChats(
  uid: string,
  onNext: (chats: Chat[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  if (!uid) {
    onNext([]);
    return () => undefined;
  }

  const chatsQuery = query(
    collection(db, 'chats'),
    where('participantIds', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(
    chatsQuery,
    (snapshot) => onNext(snapshot.docs.map((chat) => toChat(chat.data(), chat.id))),
    (error) => onError?.(error)
  );
}

/**
 * Streams the newest message page in chronological order.
 */
export function subscribeToMessages(
  chatId: string,
  onNext: (messages: Message[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE.messages)
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => onNext(snapshot.docs.map(toMessage).reverse()),
    (error) => onError?.(error)
  );
}

/**
 * Resets only the opening participant's unread count. The transaction makes
 * this safe when a new message arrives at the same time as the thread opens.
 */
export async function markChatRead(chatId: string, uid: string): Promise<void> {
  if (!chatId || !uid) return;

  const chatRef = doc(db, 'chats', chatId);

  await runTransaction(db, async (transaction) => {
    const chatSnapshot = await transaction.get(chatRef);
    if (!chatSnapshot.exists()) {
      throw new Error('This conversation is no longer available.');
    }

    const chat = toChat(chatSnapshot.data(), chatSnapshot.id);
    if (!chat.participantIds.includes(uid)) {
      throw new Error('You cannot open this conversation.');
    }

    if ((chat.unreadCount?.[uid] ?? 0) === 0) return;

    transaction.update(chatRef, {
      unreadCount: {
        ...(chat.unreadCount ?? {}),
        [uid]: 0,
      },
    });
  });
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
