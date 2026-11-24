import React from 'react';
import * as Notifications from 'expo-notifications';
import { ExpoRoot, Redirect, router, Stack, Tabs, usePathname } from 'expo-router';

import { path } from '@/constants/path';
import { __testing, usePushNotifications } from '@/hooks/usePushNotifications';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => () => ({ onTokenRefresh: jest.fn() }));
jest.mock('@/lib/api', () => ({ registerPushToken: jest.fn() }));
jest.mock('@/lib/registerForPushNotifications', () => ({
  registerForPushNotificationsAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/store/useAttributionStore', () => ({ useAttributionStore: { getState: jest.fn() } }));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (select: (state: unknown) => unknown) =>
    select({ users: [{ selected: true, tokens: { accessToken: 'test' } }] }),
}));

function RootLayout() {
  usePushNotifications();
  return (
    <>
      <RouteProbe pathname={usePathname()} />
      <Stack />
    </>
  );
}

function TabLayout() {
  return (
    <Tabs backBehavior="history">
      <Tabs.Screen name="index" options={{ lazy: false }} />
      <Tabs.Screen name="savings" options={{ lazy: false }} />
      <Tabs.Screen name="card" options={{ lazy: false }} />
      <Tabs.Screen name="rewards" options={{ lazy: false }} />
    </Tabs>
  );
}

const RouteProbe = (_props: { pathname: string }) => null;
const EmptyPage = () => null;
const CardIndex = () => <Redirect href={path.CARD_INFO} />;
const ReferralRedirect = () => <Redirect href={path.REFERRAL_PROGRAM} />;
const routes: Record<string, React.ComponentType> = {
  './_layout.tsx': RootLayout,
  './(protected)/_layout.tsx': Stack,
  './(protected)/(tabs)/_layout.tsx': TabLayout,
  './(protected)/(tabs)/index.tsx': EmptyPage,
  './(protected)/(tabs)/savings.tsx': EmptyPage,
  './(protected)/(tabs)/card/_layout.tsx': Stack,
  './(protected)/(tabs)/card/index.tsx': CardIndex,
  './(protected)/(tabs)/card/main-currency.tsx': EmptyPage,
  './(protected)/(tabs)/card/3ds/index.tsx': EmptyPage,
  './(protected)/(tabs)/card/3ds/[transactionId].tsx': EmptyPage,
  './(protected)/(tabs)/rewards/_layout.tsx': Stack,
  './(protected)/(tabs)/rewards/index.tsx': EmptyPage,
  './(protected)/(tabs)/rewards/benefits.tsx': EmptyPage,
  './(protected)/(tabs)/referral.tsx': ReferralRedirect,
  './(protected)/activity/_layout.tsx': Stack,
  './(protected)/activity/index.tsx': EmptyPage,
  './(protected)/activity/[clientTxId].tsx': EmptyPage,
  './(protected)/support/index.tsx': EmptyPage,
};
const context = Object.assign((key: string) => ({ default: routes[key] }), {
  keys: () => Object.keys(routes),
  resolve: (key: string) => key,
  id: 'push-notification-test-routes',
});

function notification(data: Record<string, string>): Notifications.NotificationResponse {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: 0,
      request: { identifier: 'test-push', content: { data }, trigger: null },
    },
  } as Notifications.NotificationResponse;
}

describe('Back after a notification tap', () => {
  let renderer: ReturnType<typeof create> | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    __testing.resetHandledResponses();
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
  });

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
  });

  async function launch() {
    await act(async () => {
      renderer = create(<ExpoRoot context={context} location={new URL('solid:///')} />);
    });
    await act(async () => jest.advanceTimersByTime(100));
  }

  function pathname() {
    return renderer.root.findByType(RouteProbe).props.pathname;
  }

  it.each([
    [{ type: 'card-3ds' }, '/card/3ds', '/'],
    [{ type: 'card-3ds', transactionId: 'challenge' }, '/card/3ds/challenge', '/'],
    [
      { type: 'card-transaction', transactionId: 'purchase' },
      '/activity/card-purchase',
      '/activity',
    ],
    [{ link: 'https://app.solid.xyz/rewards/benefits' }, '/rewards/benefits', '/rewards'],
    [{ link: 'https://app.solid.xyz/referral' }, '/rewards', '/'],
    [{ link: 'https://app.solid.xyz/savings?vault=fuse' }, '/savings', '/'],
    [{ link: 'https://app.solid.xyz/support' }, '/support', '/'],
  ])('gives a cold-start push %j a Back destination', async (data, destination, parent) => {
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(notification(data));

    await launch();

    expect(pathname()).toBe(destination);
    expect(router.canGoBack()).toBe(true);
    await act(async () => router.back());
    expect(pathname()).toBe(parent);
  });

  it('preserves the Card screen already open when the listener receives a tap', async () => {
    await launch();
    await act(async () => router.navigate(path.CARD_MAIN_CURRENCY));
    expect(pathname()).toBe('/card/main-currency');

    const [[onTap]] = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls;
    await act(async () => onTap(notification({ type: 'card-3ds' })));
    expect(pathname()).toBe('/card/3ds');

    await act(async () => router.back());
    expect(pathname()).toBe('/card/main-currency');
  });
});
