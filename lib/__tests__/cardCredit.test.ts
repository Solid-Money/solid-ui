import {
  cardCreditPillLabel,
  cardCreditSourceLine,
  cashbackBaseUsd,
  dailyYieldPillLabel,
  showsCardCreditPill,
  usedCardCredit,
} from '@/lib/cardCredit';

import type { CardCreditSummary, CardTransactionCardCredit } from '@/lib/types';

const summary = (overrides: Partial<CardCreditSummary> = {}): CardCreditSummary => ({
  availableUsd: 10,
  pendingUsd: 0,
  lifetimeGrantedUsd: 10,
  lifetimeSpentUsd: 0,
  spendable: true,
  sources: [],
  ...overrides,
});

const source = (label: string) => ({
  id: label,
  type: 'referral_welcome' as const,
  amountUsd: 10,
  label,
  createdAt: '2026-10-01T00:00:00Z',
});

describe('dailyYieldPillLabel', () => {
  it('shows the day’s yield to the cent', () => {
    expect(dailyYieldPillLabel(0.35)).toBe('+$0.35 today');
    expect(dailyYieldPillLabel(1.3)).toBe('+$1.30 today');
  });

  it('hides when it would round to nothing', () => {
    expect(dailyYieldPillLabel(0)).toBeNull();
    expect(dailyYieldPillLabel(0.004)).toBeNull();
    expect(dailyYieldPillLabel(undefined)).toBeNull();
    expect(dailyYieldPillLabel(Number.NaN)).toBeNull();
  });
});

describe('card credit pill', () => {
  it('shows only while there is spendable credit left', () => {
    expect(showsCardCreditPill(summary())).toBe(true);
    expect(showsCardCreditPill(summary({ availableUsd: 0 }))).toBe(false);
    expect(showsCardCreditPill(summary({ spendable: false }))).toBe(false);
    expect(showsCardCreditPill(undefined)).toBe(false);
  });

  it('labels the amount', () => {
    expect(cardCreditPillLabel(10)).toBe('$10 card credit');
    expect(cardCreditPillLabel(9.4)).toBe('$9.40 card credit');
  });
});

describe('cardCreditSourceLine', () => {
  it('names where the credit came from', () => {
    expect(cardCreditSourceLine([source('Dana’s invite')])).toBe('From Dana’s invite.');
    expect(cardCreditSourceLine([source('Dana’s invite'), source('Solid team')])).toBe(
      'From Dana’s invite and Solid team.',
    );
    expect(cardCreditSourceLine([source('A'), source('B'), source('C'), source('A')])).toBe(
      'From A and 2 more.',
    );
    expect(cardCreditSourceLine([])).toBe('');
  });
});

describe('card credit on a purchase', () => {
  const credit: CardTransactionCardCredit = {
    used_usd: 8.4,
    from_balance_usd: 1.6,
    remaining_usd: 1.6,
    state: 'spent',
  };

  it('knows when credit was used', () => {
    expect(usedCardCredit(credit)).toBe(true);
    expect(usedCardCredit({ ...credit, used_usd: 0 })).toBe(false);
    expect(usedCardCredit(undefined)).toBe(false);
  });

  it('earns cashback on the balance part only', () => {
    expect(cashbackBaseUsd(10, credit)).toBe(1.6);
    expect(cashbackBaseUsd(10, undefined)).toBe(10);
    expect(cashbackBaseUsd(null, undefined)).toBeNull();
  });
});
