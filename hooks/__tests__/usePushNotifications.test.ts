import { path } from '@/constants/path';

// The hook pulls in expo-notifications, firebase messaging and the API client
// at import time. None of that is involved in routing or attribution, which is
// what these tests are about.
jest.mock('expo-notifications', () => ({ addNotificationResponseReceivedListener: jest.fn() }));
jest.mock('@react-native-firebase/messaging', () => () => ({ onTokenRefresh: jest.fn() }));
jest.mock('@/lib/api', () => ({ registerPushToken: jest.fn() }));
jest.mock('@/lib/registerForPushNotifications', () => ({
  registerForPushNotificationsAsync: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
// Both zustand stores the hook imports persist through MMKV, whose native
// module does not exist in this environment. The in-memory stub is enough:
// these tests are about which screen a push opens.
// Sentry ships ESM the jest-expo preset does not transform, and the attribution
// store imports it at module scope.
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __testing } = require('@/hooks/usePushNotifications');
const { getNotificationRoute, routeForLink } = __testing;

const BASE = 'https://app.solid.xyz';
const link = (p: string) => `${BASE}${p}`;

describe('routeForLink', () => {
  it.each([
    ['/', path.HOME],
    ['/card', path.CARD_INFO],
    ['/card/activate', path.CARD_ACTIVATE],
    ['/savings', path.SAVINGS],
    ['/activity', path.ACTIVITY],
    ['/referral', path.REFERRAL],
    ['/rewards', path.REWARDS],
    ['/rewards/benefits', path.REWARDS_BENEFITS],
    ['/savings/fuse', path.SAVINGS_FUSE],
  ])('maps %s to its screen', (p, expected) => {
    expect(routeForLink(link(p))).toEqual(expected);
  });

  it('ignores the campaign query', () => {
    expect(
      routeForLink(link('/card?utm_source=card_not_used_1&utm_medium=push&utm_campaign=x')),
    ).toEqual(path.CARD_INFO);
  });

  it('tolerates a trailing slash, as the Brevo CTAs write it', () => {
    expect(routeForLink(link('/rewards/?utm_source=rewards_idle'))).toEqual(path.REWARDS);
  });

  it('treats ?referral=open as the referral sheet, not the rewards screen', () => {
    expect(routeForLink(link('/rewards?referral=open&utm_medium=push'))).toEqual(
      path.REFERRAL_PROGRAM,
    );
  });

  it('returns nothing for a link it cannot place, rather than guessing', () => {
    expect(routeForLink(link('/some/unknown/screen'))).toBeUndefined();
    expect(routeForLink('not a url')).toBeUndefined();
    expect(routeForLink(undefined)).toBeUndefined();
  });
});

describe('getNotificationRoute', () => {
  describe('pushes carrying a deep link', () => {
    it('sends a lifecycle push where its link points, not home', () => {
      // The regression this whole change exists for: every lifecycle type used
      // to fall through to `default` and open the home screen.
      expect(
        getNotificationRoute({
          type: 'kyc-approved',
          link: link('/card?utm_source=id_verified_your_card_is_ready&utm_medium=push'),
        }),
      ).toEqual(path.CARD_INFO);

      expect(
        getNotificationRoute({
          type: 'deposit-nurture',
          stage: '1',
          link: link('/savings?utm_source=you_are_officially_earning&utm_medium=push'),
        }),
      ).toEqual(path.SAVINGS);

      expect(
        getNotificationRoute({
          type: 'first-payment',
          link: link('/activity?utm_source=first_payment_done&utm_medium=push'),
        }),
      ).toEqual(path.ACTIVITY);
    });

    it('follows the link for a referral push that asks for a card', () => {
      expect(
        getNotificationRoute({
          type: 'referral-signup',
          link: link('/card?utm_source=referral_signup&utm_medium=push'),
        }),
      ).toEqual(path.CARD_INFO);
    });

    it('still opens the referral sheet where that is what the link says', () => {
      expect(
        getNotificationRoute({
          type: 'referral-qualified-referrer',
          link: link('/rewards?referral=open&utm_medium=push'),
        }),
      ).toEqual(path.REFERRAL_PROGRAM);
    });
  });

  describe('transaction pushes, which have no link', () => {
    it('opens the transaction a spend push is about', () => {
      const route = getNotificationRoute({
        type: 'card-transaction',
        status: 'approved',
        transactionId: 'tx_1',
        utm_medium: 'push',
      });
      // The activity detail route, with the `card-` prefix that tells a card row
      // from a wallet one.
      expect(route).toBe('/activity/card-tx_1');
    });

    it('falls back to the card when a decline has no transaction', () => {
      expect(getNotificationRoute({ type: 'card-transaction', status: 'declined' })).toEqual(
        path.CARD_INFO,
      );
    });

    it('takes the transaction id over any link on a 3DS challenge', () => {
      const route = getNotificationRoute({
        type: 'card-3ds',
        transactionId: 'tx_3ds',
        link: link('/'),
      });
      expect(JSON.stringify(route)).toContain('tx_3ds');
    });
  });

  describe('pushes sent before links existed', () => {
    it.each([
      ['referral-inactive', path.REFERRAL_PROGRAM],
      ['rewards-subscription-saved', path.REWARDS_BENEFITS],
      ['rewards-using-card', path.CARD_INFO],
      ['rewards-fuse-vault', path.SAVINGS_FUSE],
      ['rewards-tier-reached', path.REWARDS],
    ])('still routes %s on its type', (type, expected) => {
      expect(getNotificationRoute({ type })).toEqual(expected);
    });

    it('falls back to home for an unrecognised type', () => {
      expect(getNotificationRoute({ type: 'something-new' })).toEqual(path.HOME);
      expect(getNotificationRoute(undefined)).toEqual(path.HOME);
    });

    it('uses the type when the link is unreadable', () => {
      expect(getNotificationRoute({ type: 'rewards-idle', link: 'garbage' })).toEqual(path.REWARDS);
    });
  });
});
