import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { registerForPushNotifications } from '@/services/notificationService';

// Show notifications as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Opens the screen a notification points at. Only in-app paths are followed. */
function openFromNotification(response: Notifications.NotificationResponse) {
  const url = response.notification.request.content.data?.url;
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return;
  // Defer one tick so a tap that cold-started the app lands after the navigator mounts.
  setTimeout(() => router.push(url as Href), 0);
}

/**
 * Registers this device for the signed-in, onboarded user and routes taps.
 * `uid` is null while signed out or onboarding, which keeps everything off.
 */
export function usePushNotifications(uid: string | null, currentToken?: string) {
  useEffect(() => {
    if (!uid) return;
    void registerForPushNotifications(uid, currentToken);
  }, [uid, currentToken]);

  useEffect(() => {
    if (!uid) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);

    // A tap that launched the app happened before this listener existed.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        openFromNotification(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    return () => subscription.remove();
  }, [uid]);
}
