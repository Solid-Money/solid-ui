import {
  asFriendProgressLine,
  bigSpenderStepLine,
  capProgress,
  formatPayoutDay,
  formatRate,
  formatUsdShort,
  friendInitials,
  friendStatusLine,
  isReferralV4Live,
  spendShareLine,
  upgradeStepLine,
  welcomeStepLine,
} from '@/lib/referral/referralV4';

import type {
  ReferralRewardListItem,
  ReferralV4FriendRow,
  ReferralV4StepView,
  ReferralV4Summary,
  ReferralV4Terms,
} from '@/lib/types';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const inDays = (days: number) => new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString();

const terms: ReferralV4Terms = {
  enabled: true,
  launchAt: '2026-10-01T00:00:00Z',
  welcome: {
    referrerUsd: 10,
    friendUsd: 10,
    spendTargetUsd: 150,
    merchantTarget: 3,
    windowDays: 30,
  },
  bigSpender: { referrerUsd: 50, friendUsd: 50, spendTargetUsd: 5000, windowDays: 90 },
  upgrade: {
    primeUsd: 20,
    ultraUsd: 100,
    primeLockFuse: 50000,
    ultraLockFuse: 400000,
    lockHoldDays: 90,
  },
  spendShare: { rate: 0.01, capPerFriendUsd: 2000, payoutWeekday: 4 },
  holdDays: 14,
  bonusLimit: { enabled: true, base: 10, perActiveFriend: 3, activeSpendUsd: 250 },
  excludedCountries: ['BD', 'PH', 'KE', 'NG'],
  boost: null,
};

const step = (overrides: Partial<ReferralV4StepView> = {}): ReferralV4StepView => ({
  status: 'locked',
  amountUsd: 10,
  ...overrides,
});

const row = (overrides: Partial<ReferralV4FriendRow> = {}): ReferralV4FriendRow => ({
  referredUserId: 'u1',
  username: 'Ana R.',
  joinedAt: '2026-09-20T10:00:00Z',
  program: 'v4',
  stage: 'spending',
  earnedUsd: 0,
  onHoldUsd: 0,
  capUsd: 2000,
  countryExcluded: false,
  spendShare: { earnedUsd: 0, thisWeekUsd: 0 },
  welcome: step(),
  bigSpender: step({ amountUsd: 50 }),
  upgrade: { status: 'locked', amountUsd: 20, tier: null, via: null },
  ...overrides,
});

describe('formatting', () => {
  it('formats amounts the way the screens show them', () => {
    expect(formatUsdShort(54)).toBe('$54');
    expect(formatUsdShort(3.5)).toBe('$3.50');
    expect(formatUsdShort(1820)).toBe('$1,820');
    expect(formatRate(0.01)).toBe('1%');
    expect(formatRate(0.015)).toBe('1.5%');
  });

  it('formats the payout day', () => {
    expect(formatPayoutDay('2026-10-29T12:00:00Z')).toBe('Thu, Oct 29');
    expect(formatPayoutDay(undefined)).toBe('');
  });

  it('makes avatar initials', () => {
    expect(friendInitials('Ana R.')).toBe('AR');
    expect(friendInitials('dana')).toBe('DA');
    expect(friendInitials('tom_smith')).toBe('TS');
    expect(friendInitials('')).toBe('?');
  });

  it('reads the switch off the terms', () => {
    expect(isReferralV4Live(undefined)).toBe(false);
    expect(isReferralV4Live({ terms: { ...terms, enabled: false } } as ReferralV4Summary)).toBe(
      false,
    );
    expect(isReferralV4Live({ terms } as ReferralV4Summary)).toBe(true);
  });
});

describe('friendStatusLine', () => {
  it('shows spend share while the friend is earning', () => {
    expect(
      friendStatusLine(
        row({ stage: 'earning', spendShare: { earnedUsd: 15.6, thisWeekUsd: 3.5 } }),
        terms,
        NOW,
      ),
    ).toEqual({ text: 'Earning 1% · +$3.50 this week', tone: 'accent' });
  });

  it('counts down the welcome bonus', () => {
    expect(
      friendStatusLine(
        row({
          welcome: step({
            status: 'in_progress',
            progressUsd: 96,
            targetUsd: 150,
            merchantCount: 1,
            merchantTarget: 3,
            deadlineAt: inDays(9),
          }),
        }),
        terms,
        NOW,
      ).text,
    ).toBe('$54 to go for $10 each · 9 days left');
  });

  it('asks for shops once the spend is there', () => {
    expect(
      friendStatusLine(
        row({
          welcome: step({
            status: 'in_progress',
            progressUsd: 160,
            targetUsd: 150,
            merchantCount: 2,
            merchantTarget: 3,
          }),
        }),
        terms,
        NOW,
      ).text,
    ).toBe('1 more shop for $10 each');
  });

  it('shows big spender progress', () => {
    expect(
      friendStatusLine(
        row({
          welcome: step({ status: 'credited' }),
          bigSpender: step({
            status: 'in_progress',
            amountUsd: 50,
            progressUsd: 1820,
            targetUsd: 5000,
          }),
        }),
        terms,
        NOW,
      ).text,
    ).toBe('$1,820 of $5,000 for $50 each');
  });

  it('says when a bonus unlocks', () => {
    expect(
      friendStatusLine(
        row({
          stage: 'idle',
          welcome: step({ status: 'on_hold', unlocksAt: '2026-11-12T12:00:00Z' }),
          bigSpender: step({ status: 'expired', amountUsd: 50 }),
        }),
        terms,
        NOW,
      ).text,
    ).toBe('$10 unlocks Nov 12');
  });

  it('covers the quiet and pre-card stages', () => {
    const settled = { welcome: step({ status: 'credited' as const }) };
    expect(friendStatusLine(row({ stage: 'idle', ...settled }), terms, NOW).text).toBe(
      'No purchases this week',
    );
    expect(friendStatusLine(row({ stage: 'verifying' }), terms, NOW).text).toBe(
      'Verifying identity',
    );
    expect(friendStatusLine(row({ stage: 'card_ordered' }), terms, NOW).text).toBe(
      'Card not active yet',
    );
    expect(friendStatusLine(row({ stage: 'capped' }), terms, NOW)).toEqual({
      text: 'Reached the $2,000 limit',
      tone: 'accent',
    });
  });

  it('describes a legacy friend in today’s words', () => {
    const legacy = {
      stage: 'paid',
      rewardUsd: 25,
      payoutToken: 'soFUSE',
    } as unknown as ReferralRewardListItem;
    expect(friendStatusLine(row({ program: 'legacy', legacy }), terms, NOW)).toEqual({
      text: 'Completed · $25 · soFUSE',
      tone: 'accent',
    });
    const pending = { stage: 'spending', rewardUsd: 25 } as unknown as ReferralRewardListItem;
    expect(friendStatusLine(row({ program: 'legacy', legacy: pending }), terms, NOW).text).toBe(
      'Pending · $25 · soFUSE',
    );
  });
});

describe('reward step lines', () => {
  it('marks earned steps green with the day', () => {
    expect(
      welcomeStepLine(step({ status: 'credited', earnedAt: '2026-09-24T12:00:00Z' }), terms, NOW),
    ).toEqual({ subtitle: 'Earned Sep 24', progress: null, amountTone: 'earned' });
  });

  it('shows a hold as when it unlocks', () => {
    expect(
      welcomeStepLine(step({ status: 'on_hold', unlocksAt: '2026-11-12T12:00:00Z' }), terms, NOW)
        .subtitle,
    ).toBe('Unlocks Nov 12');
  });

  it('shows big spender progress with a bar', () => {
    const line = bigSpenderStepLine(
      step({
        status: 'in_progress',
        amountUsd: 50,
        progressUsd: 1560,
        targetUsd: 5000,
        deadlineAt: inDays(55),
      }),
      terms,
      NOW,
    );
    expect(line.subtitle).toBe('$1,560 of $5,000 · 55 days left');
    expect(line.progress).toBeCloseTo(0.312);
    expect(line.amountTone).toBe('pending');
  });

  it('describes what a locked step needs', () => {
    expect(welcomeStepLine(step(), terms, NOW).subtitle).toBe('Spend $150 at 3 shops in 30 days');
    expect(bigSpenderStepLine(step({ amountUsd: 50 }), terms, NOW).subtitle).toBe(
      'Spend $5,000 in 90 days',
    );
  });

  it('names the upgrade the friend got', () => {
    expect(
      upgradeStepLine(
        {
          status: 'credited',
          amountUsd: 20,
          tier: 'prime',
          via: 'paid',
          earnedAt: '2026-10-02T12:00:00Z',
        },
        NOW,
      ).subtitle,
    ).toBe('Got Prime on Oct 2');
    expect(
      upgradeStepLine({ status: 'locked', amountUsd: 20, tier: null, via: null }, NOW).subtitle,
    ).toBe('When they get Prime or Ultra');
  });

  it('describes the spend share', () => {
    expect(spendShareLine({ earnedUsd: 15.6, thisWeekUsd: 3.5 }, 'earning')).toEqual({
      subtitle: '+$3.50 this week · paid Thursdays',
      progress: null,
      amountTone: 'earned',
    });
    expect(spendShareLine({ earnedUsd: 0, thisWeekUsd: 0 }, 'idle').subtitle).toBe(
      'Paid Thursdays',
    );
  });

  it('measures progress to the per-friend cap', () => {
    expect(capProgress({ earnedUsd: 500, capUsd: 2000 })).toBe(0.25);
    expect(capProgress({ earnedUsd: 10, capUsd: 0 })).toBe(0);
  });
});

describe('asFriendProgressLine', () => {
  const asFriend = (welcome: ReferralV4StepView): ReferralV4Summary['asFriend'] => ({
    referrerUsername: 'dana',
    program: 'v4',
    welcome,
    bigSpender: step({ amountUsd: 50 }),
  });

  it('spells out what the invited friend still has to do', () => {
    expect(
      asFriendProgressLine(
        asFriend(
          step({
            status: 'in_progress',
            progressUsd: 96,
            targetUsd: 150,
            merchantCount: 1,
            merchantTarget: 3,
            deadlineAt: inDays(9),
          }),
        ),
        terms,
        NOW,
      ),
    ).toBe('Spend $54 more at 2 more shops in 9 days to get $10 card credit');
  });

  it('stays quiet once the bonus is earned or out of reach', () => {
    expect(asFriendProgressLine(asFriend(step({ status: 'credited' })), terms, NOW)).toBeNull();
    expect(asFriendProgressLine(asFriend(step({ status: 'expired' })), terms, NOW)).toBeNull();
    expect(asFriendProgressLine(null, terms, NOW)).toBeNull();
  });
});
