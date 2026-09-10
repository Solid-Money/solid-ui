/// <reference types="jest" />
import {
  benefitsForTier,
  durationLabel,
  tierPopupStats,
  trialDaysRemaining,
  trialOfferCopy,
  trialRemainingLabel,
  upgradeCelebrationCopy,
} from '@/components/Rewards/NewRewards/tierTrialCopy';
import { RewardsTier, RewardsUserData, TierBenefits, TierTrial } from '@/lib/types';

const trial = (overrides: Partial<TierTrial> = {}): TierTrial => ({
  id: 'trial-1',
  tier: RewardsTier.PRIME,
  source: 'admin_gift',
  status: 'pending_activation',
  durationDays: 30,
  expiresAt: null,
  hoursRemaining: 0,
  ...overrides,
});

const primeBenefits = {
  tier: RewardsTier.PRIME,
  cardCashback: { title: '4%' },
  subscriptionDiscountRate: 25,
  yieldBoostPercentage: 2,
} as TierBenefits;

describe('tierPopupStats', () => {
  it('quotes the tier the popup is about, not the user', () => {
    // A gift is usually a tier the user does not hold yet, so these come from
    // the tier-benefits endpoint rather than their own rewards payload.
    expect(tierPopupStats(primeBenefits)).toEqual([
      { value: '4%', label: 'Cashback' },
      { value: '25%', label: 'Subscriptions' },
      { value: '+2%', label: 'Yield boost' },
    ]);
  });

  it('drops a perk the tier does not grant rather than showing a zero', () => {
    expect(
      tierPopupStats({
        ...primeBenefits,
        subscriptionDiscountRate: 0,
        yieldBoostPercentage: 0,
      } as TierBenefits),
    ).toEqual([{ value: '4%', label: 'Cashback' }]);
  });

  it('shows nothing at all before the tier benefits land', () => {
    expect(tierPopupStats(undefined)).toEqual([]);
  });

  it('finds the tier being celebrated in the benefits list', () => {
    expect(benefitsForTier([primeBenefits], RewardsTier.PRIME)).toBe(primeBenefits);
    expect(benefitsForTier([primeBenefits], RewardsTier.ULTRA)).toBeUndefined();
    expect(benefitsForTier(undefined, RewardsTier.PRIME)).toBeUndefined();
  });
});

describe('trialOfferCopy', () => {
  it('tells an admin gift as a present', () => {
    const copy = trialOfferCopy(trial());

    expect(copy.title).toBe("You've received a gift");
    expect(copy.primaryLabel).toBe('Activate gift');
    expect(copy.body).toBe('30 days of Prime, on us. Activate to start your trial.');
  });

  it("prefers the admin's own message when they wrote one", () => {
    const copy = trialOfferCopy(trial({ giftMessage: 'Sorry about the card issue' }));

    expect(copy.body).toBe('Sorry about the card issue');
  });

  it('ignores a message that is only whitespace', () => {
    expect(trialOfferCopy(trial({ giftMessage: '   ' })).body).toContain('30 days of Prime');
  });

  it('tells the welcome offer as a qualification', () => {
    const copy = trialOfferCopy(trial({ source: 'promotion' }));

    expect(copy.title).toBe("You've qualified for Prime");
    expect(copy.primaryLabel).toBe('Activate Prime');
  });

  it('promises no charge and a return to the earned tier, either way', () => {
    for (const source of ['admin_gift', 'promotion'] as const) {
      const copy = trialOfferCopy(trial({ source }));

      expect(copy.note).toBe('Your trial starts when you activate.');
      expect(copy.secondaryLabel).toBe('Maybe later');
      expect(copy.footnote).toBe(
        'No charge. After 30 days, you return to your otherwise-earned tier.',
      );
    }
  });

  it('says "1 day" rather than "1 days"', () => {
    expect(trialOfferCopy(trial({ durationDays: 1 })).body).toBe(
      '1 day of Prime, on us. Activate to start your trial.',
    );
  });
});

describe('upgradeCelebrationCopy', () => {
  const data = (overrides: Partial<RewardsUserData> = {}): RewardsUserData =>
    ({ currentTier: RewardsTier.PRIME, ...overrides }) as RewardsUserData;

  it('names the trial, and how long it runs, when a trial granted the tier', () => {
    const copy = upgradeCelebrationCopy(
      data({
        activeTierTrial: trial({ status: 'active', hoursRemaining: 720 }),
      }),
    );

    expect(copy.title).toBe('Welcome to Prime');
    expect(copy.body).toBe('Your upgrade is active. Enjoy more rewards every time you spend.');
    expect(copy.note).toBe('Your 30 days of Prime start now.');
  });

  it('names FUSE savings when the balance unlocked the tier', () => {
    const copy = upgradeCelebrationCopy(
      data({
        fuseSkipLine: {
          enabled: true,
          balanceFuse: 50_000,
          balanceUsd: 780,
          unlockedTier: RewardsTier.PRIME,
          tiers: [],
        },
      }),
    );

    expect(copy.body).toBe('Your confirmed FUSE Savings balance has unlocked Prime.');
  });

  it('falls back to the points milestone', () => {
    expect(upgradeCelebrationCopy(data()).body).toBe(
      'You reached the Prime points milestone. Your new benefits are now active.',
    );
  });

  it('has its own line for the top tier', () => {
    expect(upgradeCelebrationCopy(data({ currentTier: RewardsTier.ULTRA })).body).toBe(
      "You've reached a new tier. Enjoy your highest rewards yet.",
    );
  });

  it('ignores a trial for a tier the user has since climbed past', () => {
    // Ultra earned on points while a Prime trial runs: the celebration is about
    // Ultra, so crediting the trial for it would be wrong.
    const copy = upgradeCelebrationCopy(
      data({
        currentTier: RewardsTier.ULTRA,
        activeTierTrial: trial({ status: 'active' }),
      }),
    );

    expect(copy.note).toBeUndefined();
    expect(copy.body).toBe("You've reached a new tier. Enjoy your highest rewards yet.");
  });
});

describe('countdown', () => {
  it.each([
    [720, '30d 0h left'],
    [710, '29d 14h left'],
    [13, '13h left'],
    [0, 'Ending soon'],
  ] as const)('reads %p hours as %p', (hours, label) => {
    expect(trialRemainingLabel(trial({ hoursRemaining: hours }))).toBe(label);
  });

  it('never counts below zero, whatever the clock says', () => {
    expect(trialRemainingLabel(trial({ hoursRemaining: -5 }))).toBe('Ending soon');
    expect(trialDaysRemaining(trial({ hoursRemaining: -5 }))).toBe(0);
  });

  it('rounds part-days up, so the last day still reads as a day', () => {
    expect(trialDaysRemaining(trial({ hoursRemaining: 25 }))).toBe(2);
    expect(trialDaysRemaining(trial({ hoursRemaining: 1 }))).toBe(1);
  });

  it('pluralises durations', () => {
    expect(durationLabel(1)).toBe('1 day');
    expect(durationLabel(30)).toBe('30 days');
  });
});
