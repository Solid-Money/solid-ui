import { howItWorksRules } from '@/components/Referral/v4/ReferHowItWorksSheet';
import { rewardCopy } from '@/components/Referral/v4/ReferRewardSheet';

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

describe('How it works', () => {
  it('words every rule from the terms', () => {
    const rules = howItWorksRules(summary()).join('\n');
    expect(rules).toContain('unlocks 10 days after');
    expect(rules).toContain('next Monday payout');
    expect(rules).toContain('Spend share is 2% of what your friend spends');
    expect(rules).toContain('paid every Monday');
    expect(rules).toContain(
      "If a week's share comes to less than $2, it's paid with the next one.",
    );
    expect(rules).toContain('up to $1,500 from each friend');
    expect(rules).toContain('Your first 8 welcome bonuses');
    expect(rules).toContain('spends $300 or more between day 45 and day 90 after they join');
    expect(rules).toContain('unlocks 2 more');
    expect(rules).toContain('within 100 days of a welcome or big spender bonus');
    expect(rules).toContain('never your card credit');
    expect(rules).not.toMatch(/Thursday|second month|\$10\b|\$2,000|14 days|1%/);
  });

  it('leaves out rules an older backend does not send', () => {
    const rules = howItWorksRules(
      summary({
        spendShare: { rate: 0.02, capPerFriendUsd: 1500, payoutWeekday: 1 },
        bonusLimit: { enabled: true, base: 8, perActiveFriend: 2, activeSpendUsd: 300 },
        clawback: undefined,
      }),
    ).join('\n');
    expect(rules).not.toContain('paid with the next one');
    expect(rules).not.toContain('reversed');
    // The launch window, in the launch words.
    expect(rules).toContain('in their second month');
  });
});

describe('reward sheets', () => {
  it('words each reward from the terms', () => {
    expect(rewardCopy('spendShare', terms).description).toBe(
      'Get 2% of everything your friend spends with their card. Paid every Monday, up to $1,500 per friend.',
    );
    expect(rewardCopy('welcome', terms).description).toBe(
      'You get $15 and your friend gets $12 of card credit when they spend $200 at 4 or more shops in their first 21 days.',
    );
    expect(rewardCopy('bigSpender', terms).chip).toBe('$60 each');
    expect(rewardCopy('upgrade', terms).chip).toBe('$25 or $120');
  });
});
