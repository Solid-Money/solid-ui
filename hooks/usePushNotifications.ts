import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Href, useNavigationContainerRef, useRouter } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

import { KNOWN_HOSTS } from '@/constants/deeplink';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { cardThreeDsRequestPath, cardTransactionDetailPath, path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { registerPushToken } from '@/lib/api';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';

/** `data.type` of the push for a bank deposit under Rain's $2 minimum. */
const MICRO_DEPOSIT_PUSH_TYPE = 'virtual-account-micro-deposit';

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
  /**
   * Card spend only. Projected cashback and the rate that produced it.
   *
   * `cashbackAmount` is always the USD/USDC accrual, because USDC is what is
   * actually credited. When the merchant charged in another currency the push
   * copy quotes the reward in that currency instead, and the converted figure
   * it showed rides along in the `cashbackLocal*` pair below — so a delivery
   * log can answer "what did this cardholder read" without re-deriving the rate.
   */
  cashbackAmount?: string;
  cashbackRate?: string;
  cashbackLocalAmount?: string;
  cashbackLocalCurrency?: string;
  /**
   * Campaign attribution, stamped by the backend on every push
   * (`libs/common/src/constants/push-attribution.constants.ts`). `utm_source`
   * names the message and matches the `utm_source` on the Brevo template that
   * says the same thing, so a push and its email are one row in a breakdown;
   * `utm_medium` is always 'push'; `utm_campaign` names the flow.
   */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /**
   * The deep link the push points at, campaign included — e.g.
   * `https://app.solid.xyz/card?utm_source=card_not_used_1&utm_medium=push&…`.
   * Its path is what {@link routeForLink} turns into a screen. Absent on spend
   * pushes, whose destination is one transaction and cannot be a static URL.
   */
  link?: string;
};

/**
 * Deep-link path → the screen that serves it.
 *
 * The backend's links are ordinary URLs (they have to be: the same paths are
 * the CTAs in the Brevo emails, and they open in a browser when the app is not
 * installed). In the app several of those destinations are not plain routes —
 * `/card` is a redirect shim that re-checks card status, the Fuse vault is
 * `/savings` with a param, the referral sheet is `/rewards` with another — so
 * the path is mapped to the canonical `path.*` Href rather than handed to the
 * router as a string. That way the backend owns *where a nudge points* and the
 * app keeps owning *how to get there*.
 *
 * Keys are matched after the query is stripped, with any trailing slash
 * removed.
 */
const ROUTE_BY_LINK_PATH: Record<string, Href> = {
  '/': path.HOME,
  '/card': path.CARD_INFO,
  '/card/activate': path.CARD_ACTIVATE,
  '/savings': path.SAVINGS,
  '/activity': path.ACTIVITY,
  '/referral': path.REFERRAL,
  '/rewards': path.REWARDS,
  '/rewards/benefits': path.REWARDS_BENEFITS,
  '/savings/fuse': path.SAVINGS_FUSE,
};

/**
 * The screen a push's deep link names, or undefined if it names none.
 *
 * The host is checked against {@link KNOWN_HOSTS} before the path is read, the
 * same test `redirectSystemPath` applies to a link the OS hands us. A push
 * payload is not attacker-reachable today — sending one needs our FCM
 * credentials, and the paths below resolve through a closed map to hardcoded
 * screens, so nothing here can navigate out of the app. The check is here
 * because the link is still data from outside this file, the app already has
 * one allowlist for exactly this decision, and the day a link is built from
 * something a user supplied is not the day to start looking for the control
 * point.
 *
 * `/rewards?referral=open` is the one path whose query changes the destination:
 * it is the referral sheet, which is its own Href. Everything else ignores the
 * query, which by then is only the campaign.
 *
 * Returns undefined rather than throwing for a malformed, foreign or
 * unrecognised link so the caller falls back to the `type` switch: a link we
 * cannot trust or cannot read is a reason to route the old way, never a reason
 * to drop the tap.
 */
function routeForLink(link?: string): Href | undefined {
  if (!link) return undefined;

  try {
    const url = new URL(link);
    // Scheme as well as host: `javascript://app.solid.xyz/card` parses with a
    // hostname that passes the allowlist. Nothing here would execute it — the
    // paths resolve to hardcoded screens and this never navigates to the URL —
    // but a link whose scheme is not http(s) did not come from our backend, and
    // `redirectSystemPath` screens the same way (`path.startsWith('http')`).
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!KNOWN_HOSTS.includes(url.hostname)) return undefined;

    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/rewards' && url.searchParams.get('referral') === 'open') {
      return path.REFERRAL_PROGRAM;
    }

    return ROUTE_BY_LINK_PATH[pathname];
  } catch {
    return undefined;
  }
}

/**
 * Map a push notification's `data` (set by the backend) to an in-app route.
 *
 * Order matters. A spend or 3DS push is about one specific transaction, which
 * only `transactionId` can address, so those are resolved first and never
 * carry a link. Everything else follows the link the backend stamped on it.
 * The `type` switch below it is the fallback for pushes sent before links
 * existed — a notification can sit in the tray for days, so both have to work.
 */
function getNotificationRoute(data?: NotificationData): Href {
  const type = data?.type;

  switch (type) {
    // A spend push is about one purchase, so the tap opens that purchase —
    // merchant, the dollar conversion, the fees and the cashback it earned are
    // all on the detail screen, and none of them are on the card. The id is the
    // whole address; without one (a Wirex decline never reaches the activity
    // feed, so it has no transaction to open) fall back to the card itself
    // rather than the `/card` shim's status check.
    case 'card-transaction':
      return data?.transactionId ? cardTransactionDetailPath(data.transactionId) : path.CARD_INFO;
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
    // A verification deposit's amounts live on the virtual account sheet, which
    // is a modal over home rather than a route — see openSheetForPush.
    case MICRO_DEPOSIT_PUSH_TYPE:
      return path.HOME;
  }

  const linked = routeForLink(data?.link);
  if (linked) return linked;

  // Legacy routing, for pushes that predate the deep link. Lifecycle types are
  // deliberately absent: they never had a branch here, so every one of them
  // fell to `default` and opened home — which is the gap the link fixes.

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

  // Two rewards pushes ask for something the rewards screen cannot do, so they
  // land where their copy points rather than on the generic fallback below:
  // "don't leave cashback behind" is asking for card spend, and the Fuse vault
  // promo is asking for a deposit into that specific vault. Both match the CTA
  // in the matching email (Brevo 228 → /card, 241 → /savings).
  if (type === 'rewards-using-card') {
    return path.CARD_INFO;
  }
  if (type === 'rewards-fuse-vault') {
    return path.SAVINGS_FUSE;
  }

  // Remaining rewards pushes (rewards-live, rewards-tier-reached, the boosted
  // APY flow, etc.) all carry a `rewards-` prefixed type and should open the
  // rewards screen.
  if (type?.startsWith('rewards')) {
    return path.REWARDS;
  }

  return path.HOME;
}

/**
 * Open the sheet a push points at, for the destinations that are not routes.
 *
 * The verification-deposit push asks the user to type an amount back to their
 * bank; the amounts are listed under their virtual account details, which only
 * exist as a step of the global deposit modal. The modal reads a Zustand store,
 * so setting it here works even before the deferred providers have mounted —
 * the sheet opens over home as soon as they do.
 */
function openSheetForPush(data?: NotificationData) {
  if (data?.type === MICRO_DEPOSIT_PUSH_TYPE) {
    useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
  }
}

/**
 * Record the open, and credit the session to the nudge that caused it.
 *
 * Two separate jobs. The event answers "was this push opened"; writing the
 * campaign into the attribution store answers the question the event cannot —
 * "did it lead to a deposit" — because every event the app sends from here on
 * is enriched from that store (`analytics.enrichEventParams`). So a deposit
 * completed after this tap carries the push's `utm_source`, exactly as one
 * completed after an email CTA carries the email's.
 *
 * The store's `captureFromDeepLink` is deliberately not used: it is for links
 * the OS hands us, and a push tap is not one — no `Linking` event fires, and
 * the campaign is already parsed into `data`. Calling `updateAttribution`
 * directly also keeps the first-touch record intact, which is right: a nudge to
 * an existing user is the last touch that moved them, not how they were
 * acquired.
 */
function recordOpen(data?: NotificationData) {
  try {
    const { utm_source, utm_medium, utm_campaign, type } = data ?? {};

    if (utm_source || utm_campaign) {
      useAttributionStore.getState().updateAttribution({
        utm_source,
        utm_medium,
        utm_campaign,
        attribution_captured_at: Date.now(),
      });
    }

    track(TRACKING_EVENTS.PUSH_NOTIFICATION_OPENED, {
      notification_type: type,
      utm_source,
      utm_medium,
      utm_campaign,
      // The link the push carried. Its absence is the signal that matters: it
      // means either a spend push (which never has one) or a notification sent
      // before links existed, and both route on `type` instead.
      push_link: data?.link,
    });
  } catch (error) {
    // Never let telemetry swallow the navigation below.
    console.warn('Failed to record push notification open:', error);
  }
}

/**
 * Notification responses already acted on, by the notification's own id.
 *
 * There are two ways a tap reaches this file and they overlap: the live
 * listener, and the launch response replayed below. A tap that arrives while
 * the app is running is seen by both, and navigating twice for one tap is a
 * flicker at best and a wrong screen at worst.
 *
 * Module scope rather than a ref because it has to outlive the effect: the
 * effect re-runs whenever auth flips (a logout and back in, a token refresh
 * that re-selects the user), and `getLastNotificationResponseAsync` keeps
 * returning the same launch response for the life of the process. A ref would
 * be empty on the second run and replay a tap from twenty minutes ago,
 * yanking the user off whatever they were doing.
 */
const handledResponseIds = new Set<string>();

/**
 * How many ids to remember. Only enough to cover the overlap above — a session
 * that receives hundreds of pushes must not grow this without bound, and by the
 * time it has, the oldest entries can no longer be replayed by anything.
 */
const MAX_HANDLED_RESPONSES = 50;

function rememberResponse(id: string) {
  handledResponseIds.add(id);
  if (handledResponseIds.size > MAX_HANDLED_RESPONSES) {
    // Sets iterate in insertion order, so this drops the oldest.
    const oldest = handledResponseIds.values().next();
    if (!oldest.done) handledResponseIds.delete(oldest.value);
  }
}

/** Record the open, then send the user where the push points. */
function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  navigate: (href: Href) => void,
): void {
  // No id is not a reason to drop the tap: route it, and accept that the
  // (vanishingly rare) duplicate would route twice to the same screen.
  const id = response.notification?.request?.identifier;
  if (id) {
    if (handledResponseIds.has(id)) return;
    rememberResponse(id);
  }

  const data = response.notification.request.content.data as NotificationData | undefined;
  recordOpen(data);

  try {
    navigate(getNotificationRoute(data));
    openSheetForPush(data);
  } catch (error) {
    // The navigator went away between the readiness check and here. Forget the
    // response so the next delivery — or the next run of the effect, which
    // replays the launch response — gets to try again instead of finding it
    // marked as done.
    if (id) handledResponseIds.delete(id);
    console.warn('Failed to open the screen a push notification pointed at:', error);
  }
}

/** How often to re-ask whether the root navigator has mounted. */
const NAVIGATION_READY_POLL_MS = 100;

/**
 * Whether there is a navigator to navigate yet.
 *
 * This matters because of where the push hook lives. It is called at the very
 * top of the root layout, which returns `null` until the app-ready flag and the
 * critical fonts land — so its first effects run with no `<Stack>` mounted, and
 * `router.replace` in that window throws "Attempted to navigate before mounting
 * the Root Layout component". On a cold start that window is exactly when a
 * notification tap arrives, so the tap was thrown away and the user landed on
 * home: the whole of "the payment notification never opens the transaction".
 *
 * Polled rather than subscribed because `isReady()` flips inside React
 * Navigation's own mount effect and nothing re-renders this hook when it does.
 * `useNavigationContainerRef` is safe to call before the container exists (it
 * hands back a detached ref whose `isReady()` simply answers false), the first
 * check runs during render for the common case where the navigator is already
 * up, and the timer stops for good on the first true answer.
 *
 * @param enabled Pass false to skip the polling entirely — there is no point
 * waiting for a navigator when nothing is going to navigate.
 */
function useNavigationReady(enabled: boolean): boolean {
  const navigationRef = useNavigationContainerRef();
  const [isReady, setIsReady] = useState(() => navigationRef.isReady());

  useEffect(() => {
    if (!enabled || isReady) return;

    const timer = setInterval(() => {
      if (!navigationRef.isReady()) return;
      clearInterval(timer);
      setIsReady(true);
    }, NAVIGATION_READY_POLL_MS);

    return () => clearInterval(timer);
  }, [enabled, isReady, navigationRef]);

  return isReady;
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
  const isNavigationReady = useNavigationReady(isAuthenticated && Platform.OS !== 'web');

  // Token registration. Kept apart from the tap handling below because it has
  // nothing to do with navigation and must not wait on a navigator.
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

    return unsubscribeTokenRefresh;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (Platform.OS === 'web') return;
    if (!isNavigationReady) return;

    // Handle notification taps (user taps a notification from the system tray).
    // Record the open and its campaign first, then deep-link on the link the
    // backend stamped on the push (falling back to `type` for older ones).
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      response => handleNotificationResponse(response, href => router.replace(href)),
    );

    // The tap that launched the app, which the listener above never sees.
    //
    // This is the common case for a spend push, not an edge case: a card
    // purchase notification is usually read minutes or hours later, with the
    // app long since killed. The response that woke the process is emitted by
    // the native side before any JS listener can exist, so expo-notifications
    // holds on to it — and until this read, nothing asked for it, so every
    // cold-start tap was dropped and the user landed on home.
    //
    // Deliberately inside the auth and navigator gates above: replaying a tap
    // before there is a session would only bounce the user to the welcome
    // screen, and replaying it before there is a navigator would throw. Both
    // lose the tap a second time, which is the bug, not a smaller version of it.
    //
    // Re-running this effect replays the same response, so
    // `handleNotificationResponse` drops one it has already acted on.
    try {
      const launchResponse = Notifications.getLastNotificationResponse();
      if (launchResponse) {
        handleNotificationResponse(launchResponse, href => router.replace(href));
      }
    } catch (error) {
      // Only reachable where the native module has no such method. A tap we
      // cannot read is not worth taking the app down for.
      console.warn('Failed to read the notification that launched the app:', error);
    }

    return () => {
      notificationResponseSubscription.remove();
    };
  }, [isAuthenticated, isNavigationReady, router]);
}

/** Exported for tests: routing is the contract between backend links and screens. */
export const __testing = {
  getNotificationRoute,
  routeForLink,
  handleNotificationResponse,
  resetHandledResponses: () => handledResponseIds.clear(),
};
