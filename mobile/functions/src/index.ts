import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { AccessToken } from 'livekit-server-sdk';

initializeApp();

const liveKitUrl = defineSecret('LIVEKIT_URL');
const liveKitApiKey = defineSecret('LIVEKIT_API_KEY');
const liveKitApiSecret = defineSecret('LIVEKIT_API_SECRET');

type TokenRequest = {
  sessionId?: unknown;
};

type SessionRecord = {
  teacherId?: string;
  mode?: string;
  status?: string;
};

type BookingRecord = {
  learnerId?: string;
  status?: string;
};

/**
 * Issues a short-lived LiveKit token after checking the signed-in user against
 * the session and its accepted booking. The LiveKit secret never reaches the app.
 */
export const createLiveKitToken = onCall<TokenRequest>(
  {
    region: 'us-central1',
    secrets: [liveKitUrl, liveKitApiKey, liveKitApiSecret],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in before joining a meeting.');
    }

    const sessionId = request.data.sessionId;
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
      throw new HttpsError('invalid-argument', 'A valid session id is required.');
    }

    const db = getFirestore();
    const sessionSnapshot = await db.doc(`sessions/${sessionId}`).get();
    if (!sessionSnapshot.exists) {
      throw new HttpsError('not-found', 'This session no longer exists.');
    }

    const session = sessionSnapshot.data() as SessionRecord;
    if (session.mode !== 'online') {
      throw new HttpsError('failed-precondition', 'This is not an online session.');
    }
    if (session.status === 'cancelled' || session.status === 'completed') {
      throw new HttpsError('failed-precondition', 'This meeting is no longer available.');
    }

    const isTeacher = session.teacherId === uid;
    if (!isTeacher) {
      const bookingSnapshot = await db.doc(`bookings/${sessionId}_${uid}`).get();
      const booking = bookingSnapshot.data() as BookingRecord | undefined;
      const isConfirmedLearner =
        bookingSnapshot.exists && booking?.learnerId === uid && booking.status === 'confirmed';
      if (!isConfirmedLearner) {
        throw new HttpsError(
          'permission-denied',
          'Only the teacher and confirmed learners can join this meeting.'
        );
      }
    }

    const userSnapshot = await db.doc(`users/${uid}`).get();
    const user = userSnapshot.data();
    const participantName =
      typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'SkillBridge member';
    const participantRole = isTeacher ? 'teacher' : 'learner';
    const roomName = `skillbridge-${sessionId}`;

    const token = new AccessToken(liveKitApiKey.value(), liveKitApiSecret.value(), {
      identity: uid,
      name: participantName,
      ttl: '1h',
      metadata: JSON.stringify({ role: participantRole, sessionId }),
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const serverUrl = liveKitUrl.value().trim();
    if (!/^wss:\/\//i.test(serverUrl)) {
      throw new HttpsError('internal', 'The meeting server is not configured correctly.');
    }

    return {
      serverUrl,
      participantToken: await token.toJwt(),
      roomName,
    };
  }
);
