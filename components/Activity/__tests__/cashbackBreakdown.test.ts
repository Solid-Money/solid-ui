import { buildCashbackBreakdown } from '@/components/Activity/cashbackBreakdown';
import {
  type Cashback,
  type CashbackInfo,
  CashbackStatus,
  CashbackType,
  RewardsTier,
  type RewardsUserData,
} from '@/lib/types';

const rewards = (tier: RewardsTier, subscriptionDiscountRate = 0): RewardsUserData =>
  ({
    currentTier: tier,
    cashbackRate: { core: 3, prime: 4, ultra: 5 }[tier],
    subscriptionDiscountRate,
  }) as RewardsUserData;

const row = (overrides: Partial<Cashback> = {}): Cashback =>
  ({
    _id: 'cb',
    transactionId: 'tx',
    status: CashbackStatus.Escrowed,
    createdAt: '2026-09-28T10:00:00.000Z',
    payoutAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  }) as Cashback;

const info = (overrides: Partial<CashbackInfo> = {}): CashbackInfo => ({
  amount: '+$3.00',
  isPending: true,
  isEscrowed: true,
  isPaid: false,
  isIneligible: false,
  payoutAt: '2026-10-12T10:00:00.000Z',
  ...overrides,
});

const footerText = (breakdown: ReturnType<typeof buildCashbackBreakdown>) =>
  breakdown.footer?.segments.map(segment => segment.text).join('');

describe('buildCashbackBreakdown', () => {
  it('describes standard Core cashback in escrow, with the Prime upsell (Figma 27704:3540)', () => {
    const breakdown = buildCashbackBreakdown({
      info: info(),
      cashback: row({
        cashbackPercentage: 0.03,
        cashbackPercentageSource: 'Tier',
        projectedUsdValue: 3,
      }),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.CORE),
    });

    expect(breakdown).toMatchObject({
      amountLabel: '+$3.00',
      isSubscription: false,
      typeLabel: 'Standard',
      rateLabel: '3%',
      tierLabel: 'Core',
      timing: { kind: 'releasing', payoutAt: '2026-10-12T10:00:00.000Z', holdDays: 14 },
      footer: { kind: 'upsell', linkLabel: 'Compare tiers' },
    });
    expect(footerText(breakdown)).toBe(
      'Prime would have paid you $4.00 on this purchase, plus 10% on subscriptions. ',
    );
    expect(breakdown.footer?.segments.filter(segment => segment.highlight)).toEqual([
      { text: '$4.00', highlight: true },
    ]);
  });

  it('describes a paid Prime AI subscription perk, with the other categories (Figma 27704:3904)', () => {
    const breakdown = buildCashbackBreakdown({
      info: info({
        amount: '+$2.00',
        isPending: false,
        isEscrowed: false,
        isPaid: true,
        isSubscriptionDiscount: true,
        subscriptionCategory: 'ai',
        payoutAt: '2026-09-17T10:00:00.000Z',
      }),
      cashback: row({
        status: CashbackStatus.Paid,
        type: CashbackType.SubscriptionDiscount,
        subscriptionCategory: 'ai',
      }),
      purchaseUsd: 20,
      rewardsData: rewards(RewardsTier.PRIME, 10),
    });

    expect(breakdown).toMatchObject({
      amountLabel: '+$2.00',
      isSubscription: true,
      typeLabel: 'AI subscription',
      rateLabel: '10%',
      tierLabel: 'Prime perk',
      timing: { kind: 'paid', paidAt: '2026-09-17T10:00:00.000Z' },
      footer: { kind: 'categories', linkLabel: 'See categories' },
    });
    expect(footerText(breakdown)).toBe(
      'Prime also pays 10% on Streaming, Music and Gaming, and 8% on Rides. ',
    );
    expect(
      breakdown.footer?.segments.filter(segment => segment.highlight).map(s => s.text),
    ).toEqual(['10%', '8%']);
  });

  it('lists every Ultra category on a standard purchase, with no tier left to sell', () => {
    const breakdown = buildCashbackBreakdown({
      info: info({ amount: '+$5.00' }),
      cashback: row({ cashbackPercentage: 0.05, cashbackPercentageSource: 'Tier' }),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.ULTRA, 20),
    });

    expect(breakdown.tierLabel).toBe('Ultra');
    expect(footerText(breakdown)).toBe(
      'Ultra also pays 20% on AI, Streaming, Music and Gaming, and 10% on Rides and Airlines. ',
    );
  });

  it('names the tier the stored rate was paid at, not the tier the user holds today', () => {
    const breakdown = buildCashbackBreakdown({
      info: info(),
      cashback: row({
        cashbackPercentage: 0.03,
        cashbackPercentageSource: 'Tier',
        projectedUsdValue: 3,
      }),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.PRIME, 10),
    });

    expect(breakdown.rateLabel).toBe('3%');
    expect(breakdown.tierLabel).toBe('Core');
    expect(footerText(breakdown)).toBe(
      'Ultra would have paid you $5.00 on this purchase, plus 20% on subscriptions. ',
    );
  });

  it('quotes a custom rate as stored and falls back to the live rate on older rows', () => {
    const custom = buildCashbackBreakdown({
      info: info(),
      cashback: row({ cashbackPercentage: 0.075, cashbackPercentageSource: 'User' }),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.CORE),
    });
    expect(custom.rateLabel).toBe('7.5%');
    expect(custom.tierLabel).toBe('Core');
    // Prime's 4% would not have paid more than 7.5%, so there is nothing to sell.
    expect(custom.footer).toBeUndefined();

    const legacy = buildCashbackBreakdown({
      info: info(),
      cashback: row(),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.CORE),
    });
    expect(legacy.rateLabel).toBe('3%');
  });

  it('says nothing about rate, tier or upsell on an ineligible purchase', () => {
    const breakdown = buildCashbackBreakdown({
      info: info({ amount: null, isPending: false, isEscrowed: false, isIneligible: true }),
      cashback: row({ status: CashbackStatus.Ineligible }),
      purchaseUsd: 100,
      rewardsData: rewards(RewardsTier.CORE),
    });

    expect(breakdown.amountLabel).toBe('Ineligible');
    expect(breakdown.timing).toBeUndefined();
    expect(breakdown.footer).toBeUndefined();
  });

  it('leaves the perk rate and tier out once the user no longer holds a tier with the perk', () => {
    const breakdown = buildCashbackBreakdown({
      info: info({ isSubscriptionDiscount: true, subscriptionCategory: 'streaming' }),
      cashback: row({ type: CashbackType.SubscriptionDiscount }),
      purchaseUsd: 15,
      rewardsData: rewards(RewardsTier.CORE),
    });

    expect(breakdown.typeLabel).toBe('Streaming subscription');
    expect(breakdown.rateLabel).toBeUndefined();
    expect(breakdown.tierLabel).toBeUndefined();
    expect(breakdown.footer).toBeUndefined();
  });

  it('names the status when there is no figure yet, and skips the hold length without dates', () => {
    const breakdown = buildCashbackBreakdown({
      info: info({ amount: null }),
      cashback: row({ createdAt: undefined as unknown as string }),
      purchaseUsd: null,
    });

    expect(breakdown.amountLabel).toBe('Escrowed');
    expect(breakdown.rateLabel).toBeUndefined();
    expect(breakdown.tierLabel).toBeUndefined();
    expect(breakdown.timing).toEqual({
      kind: 'releasing',
      payoutAt: '2026-10-12T10:00:00.000Z',
      holdDays: undefined,
    });
    expect(breakdown.footer).toBeUndefined();
  });
});
