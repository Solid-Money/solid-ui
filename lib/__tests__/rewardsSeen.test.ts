import {
  acknowledgeRewardMarks,
  hasNewReward,
  type RewardMarks,
  rewardMarks,
} from '@/lib/rewardsSeen';

import type {
  CardCreditSummary,
  ReferralV4RewardEvent,
  ReferralV4StepView,
  ReferralV4Summary,
} from '@/lib/types';

const at = (iso: string) => Date.parse(iso);

const credit = (createdAts: string[]): CardCreditSummary => ({
  availableUsd: 10,
  pendingUsd: 0,
  lifetimeGrantedUsd: 10,
  lifetimeSpentUsd: 0,
  spendable: true,
  sources: createdAts.map((createdAt, index) => ({
    id: `grant-${index}`,
    type: 'referral_welcome',
    amountUsd: 10,
    label: "Dana's invite",
    createdAt,
  })),
});

const event = (overrides: Partial<ReferralV4RewardEvent>): ReferralV4RewardEvent => ({
  referredUserId: 'friend-1',
  username: 'ana',
  amountUsd: 10,
  status: 'credited',
  earnedAt: '2026-10-01T10:00:00Z',
  ...overrides,
});

const summary = ({
  welcome = [],
  upgrade = [],
  asFriendWelcome,
  spendSharePaidUsd = 0,
  legacyPaidAt = [],
}: {
  welcome?: ReferralV4RewardEvent[];
  upgrade?: ReferralV4RewardEvent[];
  asFriendWelcome?: ReferralV4StepView;
  spendSharePaidUsd?: number;
  legacyPaidAt?: (string | undefined)[];
}) =>
  ({
    friends: legacyPaidAt.map((paidAt, index) => ({
      referredUserId: `legacy-${index}`,
      program: 'legacy',
      legacy: { stage: paidAt ? 'paid' : 'spending', rewardUsd: 25, paidAt },
    })),
    rewards: {
      spendShare: { earnedUsd: spendSharePaidUsd, thisWeekUsd: 0 },
      welcome: { earnedUsd: 0, events: welcome },
      bigSpender: { earnedUsd: 0, events: [] },
      upgrade: { earnedUsd: 0, events: upgrade },
    },
    asFriend: asFriendWelcome
      ? {
          referrerUsername: 'dana',
          program: 'v4',
          welcome: asFriendWelcome,
          bigSpender: { status: 'locked', amountUsd: 50 },
        }
      : null,
  }) as unknown as ReferralV4Summary;

describe('rewardMarks', () => {
  it('knows nothing about a source that has not loaded', () => {
    expect(rewardMarks(undefined, undefined)).toEqual({
      cardCreditAt: null,
      referralCreditAt: null,
      spendSharePaidUsd: null,
    });
  });

  it('takes the newest card credit grant, whatever the order', () => {
    expect(
      rewardMarks(credit(['2026-10-02T10:00:00Z', '2026-10-20T10:00:00Z']), undefined).cardCreditAt,
    ).toBe(at('2026-10-20T10:00:00Z'));
    expect(rewardMarks(credit([]), undefined).cardCreditAt).toBe(0);
  });

  it('takes the newest credited referral bonus, from either side of an invite', () => {
    const marks = rewardMarks(
      undefined,
      summary({
        welcome: [
          event({ status: 'credited', creditedAt: '2026-10-08T10:00:00Z' }),
          // Earned, not credited yet: nothing has reached the user.
          event({ status: 'on_hold', creditedAt: undefined }),
          // Reversed: it was credited once, but that is not a new reward.
          event({ status: 'reversed', creditedAt: '2026-10-25T10:00:00Z' }),
        ],
        upgrade: [event({ status: 'credited', creditedAt: '2026-10-12T10:00:00Z' })],
        asFriendWelcome: {
          status: 'credited',
          amountUsd: 10,
          creditedAt: '2026-10-15T10:00:00Z',
        },
        spendSharePaidUsd: 12.4,
      }),
    );
    expect(marks.referralCreditAt).toBe(at('2026-10-15T10:00:00Z'));
    expect(marks.spendSharePaidUsd).toBe(12.4);
  });

  it('counts a reward paid on the earlier program', () => {
    expect(
      rewardMarks(
        undefined,
        summary({
          welcome: [event({ status: 'credited', creditedAt: '2026-10-08T10:00:00Z' })],
          legacyPaidAt: [undefined, '2026-10-22T02:00:00Z'],
        }),
      ).referralCreditAt,
    ).toBe(at('2026-10-22T02:00:00Z'));
  });

  it('reads a summary with no credits as none yet', () => {
    expect(rewardMarks(undefined, summary({}))).toEqual({
      cardCreditAt: null,
      referralCreditAt: 0,
      spendSharePaidUsd: 0,
    });
  });
});

describe('hasNewReward / acknowledgeRewardMarks', () => {
  const marks = (overrides: Partial<RewardMarks> = {}): RewardMarks => ({
    cardCreditAt: at('2026-10-20T10:00:00Z'),
    referralCreditAt: at('2026-10-15T10:00:00Z'),
    spendSharePaidUsd: 12.4,
    ...overrides,
  });

  it('never pops for what was there before anything was seen', () => {
    expect(hasNewReward(marks(), undefined)).toBe(false);
    expect(hasNewReward(marks(), {})).toBe(false);
    // The first sight of each source is recorded quietly.
    expect(acknowledgeRewardMarks(undefined, marks())).toEqual({
      cardCreditAt: at('2026-10-20T10:00:00Z'),
      referralCreditAt: at('2026-10-15T10:00:00Z'),
      spendSharePaidUsd: 12.4,
    });
  });

  it('pops for a newer grant, bonus or spend share payment', () => {
    const seen = acknowledgeRewardMarks(undefined, marks())!;
    expect(hasNewReward(marks(), seen)).toBe(false);
    expect(hasNewReward(marks({ cardCreditAt: at('2026-10-21T10:00:00Z') }), seen)).toBe(true);
    expect(hasNewReward(marks({ referralCreditAt: at('2026-10-16T10:00:00Z') }), seen)).toBe(true);
    expect(hasNewReward(marks({ spendSharePaidUsd: 13.1 }), seen)).toBe(true);
    // Float noise is not a payment.
    expect(hasNewReward(marks({ spendSharePaidUsd: 12.4000001 }), seen)).toBe(false);
  });

  it('pops only once for the same reward', () => {
    const seen = acknowledgeRewardMarks(undefined, marks())!;
    const newer = marks({ cardCreditAt: at('2026-10-21T10:00:00Z') });
    expect(hasNewReward(newer, seen)).toBe(true);
    const after = acknowledgeRewardMarks(seen, newer)!;
    expect(hasNewReward(newer, after)).toBe(false);
    expect(acknowledgeRewardMarks(after, newer)).toBeNull();
  });

  it('ignores a source that has not loaded, and keeps what was seen of it', () => {
    const seen = acknowledgeRewardMarks(undefined, marks())!;
    const partial = marks({ cardCreditAt: null, spendSharePaidUsd: null });
    expect(hasNewReward(partial, seen)).toBe(false);
    expect(acknowledgeRewardMarks(seen, partial)).toBeNull();
  });

  it('starts a source late without popping, and never moves a mark back', () => {
    const seen = acknowledgeRewardMarks(undefined, marks({ cardCreditAt: null }))!;
    expect(seen.cardCreditAt).toBeUndefined();
    // Card credit loads later: recorded, no pop.
    expect(hasNewReward(marks(), seen)).toBe(false);
    const withCredit = acknowledgeRewardMarks(seen, marks())!;
    expect(withCredit.cardCreditAt).toBe(at('2026-10-20T10:00:00Z'));
    // A figure that briefly reads lower changes nothing.
    expect(acknowledgeRewardMarks(withCredit, marks({ spendSharePaidUsd: 0 }))).toBeNull();
    expect(hasNewReward(marks({ spendSharePaidUsd: 12.4 }), withCredit)).toBe(false);
  });
});
