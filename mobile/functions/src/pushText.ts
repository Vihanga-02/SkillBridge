/**
 * What each notification says and who receives it. Pure functions with no
 * Firebase imports, so the app's Jest suite tests them directly.
 *
 * Every builder returns `null` when nothing should be sent: the status did not
 * change, the recipient is the person who acted, or data is missing.
 */

export type PushMessage = { title: string; body: string; url: string };
export type PushTarget = { to: string; message: PushMessage };

type BookingDoc = {
  status?: string;
  sessionTitle?: string;
  learnerId?: string;
  learnerName?: string;
  teacherId?: string;
  teacherName?: string;
  cancelReason?: string;
  cancelledBy?: string;
};

type MessageDoc = { senderId?: string; senderName?: string; text?: string; imageUrl?: string };
type ReviewDoc = { fromUserId?: string; fromUserName?: string; toUserId?: string; rating?: number; comment?: string };
type CommentDoc = { authorId?: string; authorName?: string; text?: string };

const MAX_BODY = 140;

/** Trims and shortens free text for a notification line. */
export function clip(text: string | undefined, max = MAX_BODY): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const nameOr = (name: string | undefined, fallback: string) => clip(name, 40) || fallback;
const sessionOf = (booking: BookingDoc) => `“${clip(booking.sessionTitle, 60) || 'your session'}”`;
const quote = (text: string | undefined, max: number) => {
  const clean = clip(text, max);
  return clean ? `: “${clean}”` : '';
};

/** A learner asked for a seat → tell the teacher. */
export function bookingCreatedPush(bookingId: string, booking: BookingDoc): PushTarget | null {
  if (booking.status !== 'pending' || !booking.teacherId || booking.teacherId === booking.learnerId) {
    return null;
  }
  return {
    to: booking.teacherId,
    message: {
      title: 'New booking request',
      body: `${nameOr(booking.learnerName, 'A learner')} wants to join ${sessionOf(booking)}.`,
      url: `/booking/${bookingId}`,
    },
  };
}

/** A booking changed status → tell whoever did not make the change. */
export function bookingStatusPush(
  bookingId: string,
  before: BookingDoc | undefined,
  after: BookingDoc | undefined
): PushTarget | null {
  if (!before || !after || before.status === after.status) return null;

  const url = `/booking/${bookingId}`;
  const learner = after.learnerId;
  const teacher = after.teacherId;
  const teacherName = nameOr(after.teacherName, 'Your teacher');

  switch (after.status) {
    case 'confirmed':
      return learner
        ? { to: learner, message: { title: 'Booking confirmed', body: `${teacherName} confirmed your seat in ${sessionOf(after)}.`, url } }
        : null;

    case 'declined': {
      const reason = clip(after.cancelReason, 100);
      return learner
        ? {
            to: learner,
            message: {
              title: 'Booking declined',
              body: `${teacherName} declined your request for ${sessionOf(after)}.${reason ? ` Reason: ${reason}` : ''}`,
              url,
            },
          }
        : null;
    }

    case 'cancelled': {
      // Older app versions did not record who cancelled; guessing could tell the
      // wrong person, so those cancellations send nothing.
      if (after.cancelledBy && after.cancelledBy === learner && teacher) {
        return {
          to: teacher,
          message: {
            title: 'Booking cancelled',
            body: `${nameOr(after.learnerName, 'A learner')} cancelled their booking for ${sessionOf(after)}.`,
            url,
          },
        };
      }
      if (after.cancelledBy && after.cancelledBy === teacher && learner) {
        const reason = clip(after.cancelReason, 100);
        return {
          to: learner,
          message: {
            title: 'Session cancelled',
            body: reason ? `${sessionOf(after)}: ${reason}` : `${teacherName} cancelled ${sessionOf(after)}.`,
            url,
          },
        };
      }
      return null;
    }

    case 'completed':
      return learner
        ? { to: learner, message: { title: 'Session completed', body: `How was ${sessionOf(after)}? Leave a review for ${teacherName}.`, url } }
        : null;

    default:
      return null;
  }
}

/** A chat message → tell the other participant. */
export function chatMessagePush(
  chatId: string,
  participantIds: unknown,
  message: MessageDoc
): PushTarget | null {
  if (!message.senderId || !Array.isArray(participantIds)) return null;
  const to = participantIds.find(
    (uid): uid is string => typeof uid === 'string' && uid !== message.senderId
  );
  if (!to) return null;

  const body = clip(message.text) || (message.imageUrl ? 'Sent a photo' : '');
  if (!body) return null;

  const senderName = nameOr(message.senderName, 'New message');
  return {
    to,
    message: {
      title: senderName,
      body,
      url: `/chat/${chatId}?participantName=${encodeURIComponent(senderName)}`,
    },
  };
}

/** Someone reviewed a user → tell them. */
export function reviewPush(review: ReviewDoc): PushTarget | null {
  if (!review.toUserId || review.toUserId === review.fromUserId) return null;
  const stars = typeof review.rating === 'number' && review.rating > 0 ? ` ${Math.round(review.rating)}★` : '';
  return {
    to: review.toUserId,
    message: {
      title: 'New review',
      body: `${nameOr(review.fromUserName, 'Someone')} rated you${stars}${quote(review.comment, 80)}`,
      url: `/user/${review.toUserId}`,
    },
  };
}

/** A comment on a post → tell the post's author. */
export function postCommentPush(postId: string, postAuthorId: unknown, comment: CommentDoc): PushTarget | null {
  if (typeof postAuthorId !== 'string' || !postAuthorId || postAuthorId === comment.authorId) return null;
  return {
    to: postAuthorId,
    message: {
      title: 'New comment',
      body: `${nameOr(comment.authorName, 'Someone')} commented on your post${quote(comment.text, 80)}`,
      url: `/post/${postId}`,
    },
  };
}

/** A reply to a comment → tell the comment's author. */
export function commentReplyPush(postId: string, commentAuthorId: unknown, reply: CommentDoc): PushTarget | null {
  if (typeof commentAuthorId !== 'string' || !commentAuthorId || commentAuthorId === reply.authorId) return null;
  return {
    to: commentAuthorId,
    message: {
      title: 'New reply',
      body: `${nameOr(reply.authorName, 'Someone')} replied to your comment${quote(reply.text, 80)}`,
      url: `/post/${postId}`,
    },
  };
}
