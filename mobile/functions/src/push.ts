import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

import type { PushTarget } from './pushText';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Must match `PUSH_CHANNEL_ID` in the app's `notificationService.ts`. */
const CHANNEL_ID = 'default';
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

type ExpoTicket = { status?: 'ok' | 'error'; message?: string; details?: { error?: string } };

/**
 * Sends one notification to a user's device through the Expo Push API.
 * Never throws: a failed push must not retry the trigger or affect app data.
 * The only write is removing a token Expo reports as no longer registered.
 */
export async function sendPush(target: PushTarget | null): Promise<void> {
  if (!target) return;
  try {
    const userRef = getFirestore().doc(`users/${target.to}`);
    const token = (await userRef.get()).get('expoPushToken');
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return;

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: target.message.title,
        body: target.message.body,
        data: { url: target.message.url },
        sound: 'default',
        priority: 'high',
        channelId: CHANNEL_ID,
      }),
    });

    const result = (await response.json().catch(() => null)) as { data?: ExpoTicket } | null;
    const ticket = result?.data;
    if (!response.ok || ticket?.status === 'error') {
      logger.warn('Expo push was not accepted', { to: target.to, status: response.status, ticket });
    }

    // The app was uninstalled or the token rotated: stop sending to it. Only
    // clear it if it is still the same token, so a fresh registration survives.
    if (ticket?.details?.error === 'DeviceNotRegistered') {
      const current = (await userRef.get()).get('expoPushToken');
      if (current === token) await userRef.update({ expoPushToken: FieldValue.delete() });
    }
  } catch (error) {
    logger.error('Push notification failed', { to: target.to, error });
  }
}
