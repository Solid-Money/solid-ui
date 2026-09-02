import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Href, useRouter } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

import { cardThreeDsRequestPath, path } from '@/constants/path';
import { registerPushToken } from '@/lib/api';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';
import { useUserStore } from '@/store/useUserStore';

/** What the backend puts in a push's `data`. FCM values are always strings. */
type NotificationData = {
  type?: string;
  /** 3DS: the challenge the tap has to open. Card spend: the transaction. */
  transactionId?: string;
  amount?: string;
  currency?: string;
  merchantName?: string;
  cardLast4?: string;
  /** Card spend only. Which outcome — approved, refunded, declined, reversed. */
  status?: string;
  /** Card spend only. Which issuer settled it; never shown to the cardholder. */
  provider?: string;
  /**
   * Card spend only, and only when the merchant charged in another currency:
   * what was on the terminal, alongside `amount`/`currency` in USD.
   */
  localAmount?: string;
  localCurrency?: string;
  /** Card spend only. Projected USDC cashback and the rate that produced it. */
  cashbackAmount?: string;
  cashbackRate?: string;
};

/**
 * Map a push notification's `data` (set by the backend) to an in-app route.
 * Card payment notifications open the card screen; anything else goes home.
 *
 * Takes the whole payload rather than just `type` because one destination needs
 * more than the type to be reachable: a 3D Secure challenge is a question about
 * one specific transaction, and the card screen is not an answer to it.
 */
function getNotificationRoute(data?: NotificationData): Href {
  const type = data?.type;

  // Referral cashback pushes (referral-signup, referral-inactive,
  // referral-qualified-*) open the referral program popup on the rewards screen
  // via the ?referral=open deep link.
  if (type?.startsWith('referral')) {
    return path.REFERRAL_PROGRAM;
  }

  // Subscription discount pushes (rewards-subscription-live/-saved/-upsell)
  // open the tier benefits screen, where the discount perk lives.
  if (type?.startsWith('rewards-subscription')) {
    return path.REWARDS_BENEFITS;
  }

  // Remaining rewards pushes (rewards-live, rewards-tier-reached, the boosted
  // APY flow, etc.) all carry a `rewards-` prefixed type and should open the
  // rewards screen.
  if (type?.startsWith('rewards')) {
    return path.REWARDS;
  }

  switch (type) {
    // Only a card holder gets a transaction push, so open the card itself
    // rather than the `/card` shim's status check.
    case 'card-transaction':
      return path.CARD_INFO;
    // A 3DS challenge is held by the merchant until it is answered, so the tap
    // lands straight on the decision screen. The amount and merchant ride along
    // so it can render before the pending list has loaded. Without an id there
    // is no challenge to open, so fall back to the list.
    case 'card-3ds':
      return data?.transactionId
        ? cardThreeDsRequestPath(data.transactionId, {
            amount: data.amount,
            currency: data.currency,
            merchantName: data.merchantName,
            cardLast4: data.cardLast4,
          })
        : path.CARD_3DS;
    default:
      return path.HOME;
  }
}

/**
 * Manages push notification lifecycle: token refresh and notification tap handling.
 * Must be mounted inside the root layout so listeners are active for the entire session.
 * Only activates when a user is authenticated (has a selected user with tokens).
 */
export function usePushNotifications() {
  const router = useRouter();
  const isAuthenticated = useUserStore(state =>
    state.users.some(u => u.selected && !!u.tokens?.accessToken),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    if (Platform.OS === 'web') return;

    // Refresh the push token for users who already granted permission without
    // putting the OS prompt in front of the notification onboarding drawer.
    registerForPushNotificationsAsync({ requestPermission: false }).catch(err => {
      console.warn('Push notification registration failed:', err);
    });

    // Re-register token whenever FCM refreshes it (e.g., app reinstall, token expiry)
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
      try {
        await registerPushToken(newToken, Platform.OS as 'ios' | 'android');
      } catch (error) {
        console.warn('Failed to register refreshed push token:', error);
      }
    });

    // Handle notification taps (user taps a notification from the system tray).
    // Deep-link based on the `type` the backend set in the notification data;
    // fall back to home for anything unrecognised.
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data as NotificationData | undefined;
        router.replace(getNotificationRoute(data));
      },
    );

    return () => {
      unsubscribeTokenRefresh();
      notificationResponseSubscription.remove();
    };
  }, [isAuthenticated, router]);
}
