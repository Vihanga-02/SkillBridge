/**
 * Push notification registration.
 *
 * Everything here is best-effort: a phone without Google Play services, a
 * denied permission or a network hiccup must never block login or any screen.
 * Failures are logged and swallowed. The Cloud Functions in `functions/src`
 * read `users/{uid}.expoPushToken` to decide where to send.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { saveExpoPushToken } from '@/services/pushTokenStore';

/** Must match `channelId` in `functions/src/push.ts`. */
export const PUSH_CHANNEL_ID = 'default';

/**
 * Gets this device's Expo push token and stores it on the user, asking for
 * permission once if it has not been decided yet. Never throws.
 */
export async function registerForPushNotifications(
  uid: string,
  currentToken?: string
): Promise<void> {
  try {
    // Emulators cannot receive remote pushes.
    if (!Device.isDevice) return;

    // On Android 13+ the channel must exist before a token is requested,
    // otherwise the permission prompt never appears.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'SkillBridge',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token && token !== currentToken) await saveExpoPushToken(uid, token);
  } catch (error) {
    console.warn('Push notifications unavailable:', error);
  }
}
