import React from 'react';
import * as Notifications from 'expo-notifications';
import { ExpoRoot, router, Stack, Tabs, useLocalSearchParams, usePathname } from 'expo-router';

import { path } from '@/constants/path';
import { useHomeLinkAction } from '@/hooks/useHomeLinkAction';
import { __testing, usePushNotifications } from '@/hooks/usePushNotifications';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

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
jest.mock('@/hooks/useOpenDepositFlow', () => ({ useOpenDepositFlow: () => jest.fn() }));
jest.mock('@/store/useCardPaneStore', () => ({
  useCardPaneStore: (select: (state: object) => unknown) =>
    select({ openSpendMode: jest.fn(), open: jest.fn() }),
}));

const ID = '000000000000000000000001';
const LINK = `https://app.solid.xyz/?whatsNew=${ID}&whatsNewStep=2&utm_source=bf_a&utm_medium=push&utm_campaign=bf`;

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
      <Tabs.Screen name="card" options={{ lazy: false }} />
      <Tabs.Screen name="rewards" options={{ lazy: false }} />
    </Tabs>
  );
}

/** Home as far as a link is concerned: it acts on its one-shot params. */
function Home() {
  useHomeLinkAction({
    isCardKnown: true,
    hasCard: false,
    isSpendModeKnown: true,
    canChangeMode: false,
  });
  return <ParamsProbe params={useLocalSearchParams()} />;
}

const RouteProbe = (_props: { pathname: string }) => null;
const ParamsProbe = (_props: { params: Record<string, unknown> }) => null;
const EmptyPage = () => null;
const routes: Record<string, React.ComponentType> = {
  './_layout.tsx': RootLayout,
  './(protected)/_layout.tsx': Stack,
  './(protected)/(tabs)/_layout.tsx': TabLayout,
  './(protected)/(tabs)/index.tsx': Home,
  './(protected)/(tabs)/card/_layout.tsx': Stack,
  './(protected)/(tabs)/card/index.tsx': EmptyPage,
  './(protected)/(tabs)/card/main-currency.tsx': EmptyPage,
  './(protected)/(tabs)/rewards/_layout.tsx': Stack,
  './(protected)/(tabs)/rewards/index.tsx': EmptyPage,
  './(protected)/(tabs)/rewards/benefits.tsx': EmptyPage,
};
const context = Object.assign((key: string) => ({ default: routes[key] }), {
  keys: () => Object.keys(routes),
  resolve: (key: string) => key,
  id: 'whats-new-push-test-routes',
});

let pushId = 0;
function notification(link: string): Notifications.NotificationResponse {
  pushId += 1;
  // What an admin push campaign's variant carries (backend `notificationFor`).
  const data: Record<string, string> = { type: 'campaign-bf-a', link };
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: 0,
      request: {
        identifier: `whats-new-push-${pushId}`,
        content: { data },
        trigger: null,
      },
    },
  } as Notifications.NotificationResponse;
}

describe("A What's New push tap", () => {
  let renderer: ReturnType<typeof create> | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    __testing.resetHandledResponses();
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
    useWhatsNewStore.setState({ request: null });
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

  const pathname = () => renderer.root.findByType(RouteProbe).props.pathname;
  /** Home's params as it sees them now: a handled link's are cleared. */
  const homeParams = () =>
    renderer.root
      .findAllByType(ParamsProbe)
      .map((probe: { props: { params: Record<string, unknown> } }) => probe.props.params);
  const tap = async (link = LINK) => {
    const [[onTap]] = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls;
    await act(async () => onTap(notification(link)));
  };

  it('asks for the announcement on its page when it launched the app', async () => {
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(notification(LINK));

    await launch();

    expect(pathname()).toBe('/');
    expect(useWhatsNewStore.getState().request).toEqual({ id: ID, step: 2 });
    // Cleared, so a remount of Home doesn't ask again.
    for (const params of homeParams()) expect(params.whatsNew).toBeUndefined();
  });

  it('asks again for a second tap while Home is open', async () => {
    await launch();

    await tap();
    expect(useWhatsNewStore.getState().request).toEqual({ id: ID, step: 2 });

    // The popup answered the first ask and was closed.
    act(() => useWhatsNewStore.setState({ request: null }));
    await tap();
    expect(useWhatsNewStore.getState().request).toEqual({ id: ID, step: 2 });
    expect(pathname()).toBe('/');
  });

  it('brings Home forward and asks from another tab, and Back returns there', async () => {
    await launch();
    await act(async () => router.navigate(path.CARD_MAIN_CURRENCY));
    expect(pathname()).toBe('/card/main-currency');

    await tap();
    expect(pathname()).toBe('/');
    expect(useWhatsNewStore.getState().request).toEqual({ id: ID, step: 2 });

    await act(async () => router.back());
    expect(pathname()).toBe('/card/main-currency');
    // Going back is not a tap: nothing is asked for again.
    act(() => useWhatsNewStore.setState({ request: null }));
    await act(async () => jest.advanceTimersByTime(100));
    expect(useWhatsNewStore.getState().request).toBeNull();
  });
});
