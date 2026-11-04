import { allRewardsRows } from '@/components/Referral/v4/ReferAllRewardsSheet';
import { rewardCopy, rewardRules } from '@/components/Referral/v4/ReferRewardSheet';

import type { ReferralV4Summary, ReferralV4Terms } from '@/lib/types';

// Only the copy is under test: the sheets' building blocks render nothing here.
jest.mock('@/components/Referral/v4/ReferSheet', () => () => null);
jest.mock('@/components/Referral/v4/ReferV4Primitives', () => ({}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({ cn: () => '' }));
jest.mock('lucide-react-native', () => ({ Check: () => null }));

// A Monday 12:00 UTC run (Monday from UTC−12 to UTC+11, wherever CI runs) and
// every other number off the launch terms, so nothing below can pass by
// matching a default.
const terms: ReferralV4Terms = {
  enabled: true,
  launchAt: '2026-10-01T00:00:00Z',
  paused: false,
  welcome: {
    referrerUsd: 15,
    friendUsd: 12,
    spendTargetUsd: 200,
    merchantTarget: 4,
    windowDays: 21,
  },
  bigSpender: { referrerUsd: 60, friendUsd: 60, spendTargetUsd: 4000, windowDays: 75 },
  upgrade: {
    primeUsd: 25,
    ultraUsd: 120,
    primeLockFuse: 50000,
    ultraLockFuse: 400000,
    lockHoldDays: 90,
  },
  spendShare: {
    rate: 0.02,
    capPerFriendUsd: 1500,
    payoutWeekday: 1,
    payoutHourUtc: 12,
    minWeeklyPayoutUsd: 2,
  },
  holdDays: 10,
  bonusLimit: {
    enabled: true,
    base: 8,
    perActiveFriend: 2,
    activeSpendUsd: 300,
    monthTwoFromDays: 45,
    monthTwoToDays: 90,
  },
  excludedCountries: ['BD'],
  boost: null,
  clawback: { enabled: true, watchDays: 100 },
};

const summary = (overrides: Partial<ReferralV4Terms> = {}) =>
  ({
    terms: { ...terms, ...overrides },
    bonusLimit: { limit: 8, used: 3, waiting: 0 },
  }) as unknown as ReferralV4Summary;

// The payout weekday is worked out in the device's time zone: pin it to UTC so
// the Monday 12:00 UTC run reads "Monday" wherever the tests run.
beforeAll(() => {
  jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('How you earn (View all)', () => {
  it('lists every reward from the terms', () => {
    expect(allRewardsRows(terms)).toEqual([
      {
        kind: 'spendShare',
        title: 'Spend share',
        subtitle: 'of everything they spend',
        value: '2%',
      },
      {
        kind: 'welcome',
        title: 'Welcome bonus',
        subtitle: 'after $200 at 4+ shops in 21 days',
        value: '$15',
      },
      {
        kind: 'bigSpender',
        title: 'Big spender bonus',
        subtitle: 'after $4,000 in 75 days',
        value: '$60 each',
      },
      {
        kind: 'upgrade',
        title: 'Upgrade bonus',
        subtitle: 'for Prime or Ultra',
        value: 'Up to $120',
      },
    ]);
  });
});

describe('reward sheets', () => {
  it('words each reward from the terms', () => {
    expect(rewardCopy('spendShare', terms).description).toBe(
      'Get 2% of everything your friend spends with their card, up to $1,500 per friend.',
    );
    expect(rewardCopy('welcome', terms).description).toBe(
      'You get $15 and your friend gets $12 of card credit when they spend $200 at 4 or more shops in their first 21 days.',
    );
    expect(rewardCopy('bigSpender', terms).chip).toBe('$60 each');
    expect(rewardCopy('upgrade', terms).chip).toBe('$25 or $120');
  });
});

describe('reward sheet rules', () => {
  const texts = (kind: Parameters<typeof rewardRules>[0], s = summary()) =>
    rewardRules(kind, s).map(rule => rule.text);

  it('says when each reward is paid, from the terms', () => {
    expect(texts('spendShare')).toEqual([
      'Paid every Monday in soFUSE',
      'A week under $2 is paid with the next one',
    ]);
    expect(texts('welcome')).toEqual([
      'Unlocks 10 days later, paid on Monday',
      '3 of 8 welcome bonuses used',
    ]);
    expect(texts('bigSpender')).toEqual(['Unlocks 10 days later, paid on Monday']);
    // A lock upgrade is earned after the lock hold, then waits the bonus hold too.
    expect(texts('upgrade')).toEqual([
      'Subscription: paid 10 days later, on Monday',
      'FUSE lock: unlocks 10 days after 90 days locked, paid on Monday',
    ]);
  });

  it('leaves the bonus limit out while it is off', () => {
    const off = { ...summary(), bonusLimit: null } as unknown as ReferralV4Summary;
    expect(texts('welcome', off)).toEqual(['Unlocks 10 days later, paid on Monday']);
  });

  it('drops the wait when there is no hold', () => {
    const none = summary({ holdDays: 0 });
    expect(texts('bigSpender', none)).toEqual(['Paid on Monday']);
    expect(texts('upgrade', none)).toEqual([
      'Subscription: paid on Monday',
      'FUSE lock: paid on Monday after 90 days locked',
    ]);
  });

  it('promises no payday while payouts are paused, and keeps the limit', () => {
    const paused = summary({ paused: true });
    const note = 'Payouts are paused for now — everything you earn is kept.';
    expect(texts('spendShare', paused)).toEqual([note]);
    expect(texts('upgrade', paused)).toEqual([note]);
    expect(texts('welcome', paused)).toEqual([note, '3 of 8 welcome bonuses used']);
  });

  it('drops the weekly minimum line when there is none', () => {
    const none = summary({
      spendShare: { ...terms.spendShare, minWeeklyPayoutUsd: 0 },
    });
    expect(texts('spendShare', none)).toEqual(['Paid every Monday in soFUSE']);
  });
});
