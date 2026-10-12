import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { sendPush } from './push';
import {
  bookingCreatedPush,
  bookingStatusPush,
  chatMessagePush,
  commentReplyPush,
  postCommentPush,
  reviewPush,
} from './pushText';

/**
 * Firestore triggers must run in the database's region — this project's
 * database is in `asia-south1` (Mumbai). `createLiveKitToken` stays in
 * `us-central1`, because the app calls it there.
 */
const REGION = 'asia-south1';

/** These triggers only read data and send pushes — they never change app data. */

export const onBookingCreated = onDocumentCreated(
  { document: 'bookings/{bookingId}', region: REGION },
  async (event) => {
    await sendPush(bookingCreatedPush(event.params.bookingId, event.data?.data() ?? {}));
  }
);

export const onBookingUpdated = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: REGION },
  async (event) => {
    await sendPush(
      bookingStatusPush(event.params.bookingId, event.data?.before.data(), event.data?.after.data())
    );
  }
);

export const onChatMessageCreated = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', region: REGION },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const chat = await getFirestore().doc(`chats/${event.params.chatId}`).get();
    await sendPush(chatMessagePush(event.params.chatId, chat.get('participantIds'), message));
  }
);

export const onReviewCreated = onDocumentCreated(
  { document: 'reviews/{reviewId}', region: REGION },
  async (event) => {
    await sendPush(reviewPush(event.data?.data() ?? {}));
  }
);

export const onPostCommentCreated = onDocumentCreated(
  { document: 'posts/{postId}/comments/{commentId}', region: REGION },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;
    const post = await getFirestore().doc(`posts/${event.params.postId}`).get();
    await sendPush(postCommentPush(event.params.postId, post.get('authorId'), comment));
  }
);

export const onCommentReplyCreated = onDocumentCreated(
  { document: 'posts/{postId}/comments/{commentId}/replies/{replyId}', region: REGION },
  async (event) => {
    const reply = event.data?.data();
    if (!reply) return;
    const parent = await getFirestore()
      .doc(`posts/${event.params.postId}/comments/${event.params.commentId}`)
      .get();
    await sendPush(commentReplyPush(event.params.postId, parent.get('authorId'), reply));
  }
);
