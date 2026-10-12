import {
  bookingCreatedPush,
  bookingStatusPush,
  chatMessagePush,
  clip,
  commentReplyPush,
  postCommentPush,
  reviewPush,
} from '../functions/src/pushText';

const booking = {
  sessionTitle: 'React Basics',
  learnerId: 'learner',
  learnerName: 'Kasun',
  teacherId: 'teacher',
  teacherName: 'Nimali',
  cancelReason: '',
};

describe('booking created', () => {
  it('tells the teacher about a new request and links to the booking', () => {
    expect(bookingCreatedPush('b1', { ...booking, status: 'pending' })).toEqual({
      to: 'teacher',
      message: {
        title: 'New booking request',
        body: 'Kasun wants to join “React Basics”.',
        url: '/booking/b1',
      },
    });
  });

  it('sends nothing for a booking that is not pending or has no teacher', () => {
    expect(bookingCreatedPush('b1', { ...booking, status: 'confirmed' })).toBeNull();
    expect(bookingCreatedPush('b1', { ...booking, status: 'pending', teacherId: undefined })).toBeNull();
  });
});

describe('booking status changes', () => {
  const change = (from: string, to: string, patch = {}) =>
    bookingStatusPush('b1', { ...booking, status: from }, { ...booking, status: to, ...patch });

  it('ignores updates that keep the same status', () => {
    expect(change('pending', 'pending')).toBeNull();
    expect(bookingStatusPush('b1', undefined, { ...booking, status: 'confirmed' })).toBeNull();
  });

  it('tells the learner when confirmed', () => {
    expect(change('pending', 'confirmed')).toMatchObject({
      to: 'learner',
      message: { title: 'Booking confirmed', body: 'Nimali confirmed your seat in “React Basics”.' },
    });
  });

  it('tells the learner when declined, with the reason', () => {
    expect(change('pending', 'declined', { cancelReason: 'Fully booked' })?.message.body).toBe(
      'Nimali declined your request for “React Basics”. Reason: Fully booked'
    );
  });

  it('tells the teacher when the learner cancelled', () => {
    expect(change('confirmed', 'cancelled', { cancelledBy: 'learner' })).toMatchObject({
      to: 'teacher',
      message: { title: 'Booking cancelled', body: 'Kasun cancelled their booking for “React Basics”.' },
    });
  });

  it('tells the learner when the teacher cancelled, with the reason', () => {
    expect(
      change('confirmed', 'cancelled', { cancelledBy: 'teacher', cancelReason: 'Room unavailable' })
    ).toMatchObject({
      to: 'learner',
      message: { title: 'Session cancelled', body: '“React Basics”: Room unavailable' },
    });
  });

  it('sends nothing for a cancellation from an older app that did not record who cancelled', () => {
    expect(change('confirmed', 'cancelled')).toBeNull();
  });

  it('asks the learner for a review when completed', () => {
    expect(change('confirmed', 'completed')).toMatchObject({
      to: 'learner',
      message: { title: 'Session completed', url: '/booking/b1' },
    });
  });
});

describe('chat messages', () => {
  it('notifies the other participant with the text and a link back to the chat', () => {
    expect(
      chatMessagePush('c1', ['kasun', 'nimali'], { senderId: 'kasun', senderName: 'Kasun', text: ' Hi there ' })
    ).toEqual({
      to: 'nimali',
      message: { title: 'Kasun', body: 'Hi there', url: '/chat/c1?participantName=Kasun' },
    });
  });

  it('describes a photo-only message', () => {
    expect(
      chatMessagePush('c1', ['kasun', 'nimali'], { senderId: 'kasun', senderName: 'Kasun', imageUrl: 'https://x' })
        ?.message.body
    ).toBe('Sent a photo');
  });

  it('sends nothing without a sender, another participant, or any content', () => {
    expect(chatMessagePush('c1', ['kasun'], { senderId: 'kasun', text: 'hi' })).toBeNull();
    expect(chatMessagePush('c1', undefined, { senderId: 'kasun', text: 'hi' })).toBeNull();
    expect(chatMessagePush('c1', ['kasun', 'nimali'], { senderId: 'kasun', text: '   ' })).toBeNull();
  });
});

describe('reviews and comments', () => {
  it('tells the reviewed user, with stars and a short quote', () => {
    expect(
      reviewPush({ fromUserId: 'a', fromUserName: 'Kasun', toUserId: 'b', rating: 5, comment: 'Great teacher' })
    ).toEqual({
      to: 'b',
      message: { title: 'New review', body: 'Kasun rated you 5★: “Great teacher”', url: '/user/b' },
    });
  });

  it('tells a post author about a comment and a comment author about a reply', () => {
    expect(postCommentPush('p1', 'author', { authorId: 'kasun', authorName: 'Kasun', text: 'Nice tip' })).toMatchObject({
      to: 'author',
      message: { title: 'New comment', body: 'Kasun commented on your post: “Nice tip”', url: '/post/p1' },
    });
    expect(commentReplyPush('p1', 'commenter', { authorId: 'kasun', authorName: 'Kasun', text: 'Agreed' })).toMatchObject({
      to: 'commenter',
      message: { title: 'New reply', url: '/post/p1' },
    });
  });

  it('never notifies people about their own review, comment or reply', () => {
    expect(reviewPush({ fromUserId: 'a', toUserId: 'a', rating: 5 })).toBeNull();
    expect(postCommentPush('p1', 'kasun', { authorId: 'kasun', text: 'hi' })).toBeNull();
    expect(commentReplyPush('p1', 'kasun', { authorId: 'kasun', text: 'hi' })).toBeNull();
    expect(postCommentPush('p1', undefined, { authorId: 'kasun', text: 'hi' })).toBeNull();
  });
});

describe('clip', () => {
  it('collapses whitespace and shortens long text with an ellipsis', () => {
    expect(clip('  a   b  ')).toBe('a b');
    expect(clip('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(clip(undefined)).toBe('');
  });
});
