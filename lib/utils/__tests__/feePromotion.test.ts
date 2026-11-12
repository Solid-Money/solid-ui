import {
  bankDepositFeeLine,
  eurDepositPromotion,
  eurDepositPromotionCopy,
  formatFiat,
  promotionLastDay,
  readBankDepositFee,
  UserFeePromotion,
} from '@/lib/utils/feePromotion';

const NOW = Date.parse('2026-11-20T12:00:00.000Z');

const promotion = (overrides: Partial<UserFeePromotion> = {}): UserFeePromotion => ({
  id: 'promo-1',
  name: 'Free SEPA deposits',
  scope: 'eur_bank_deposit',
  product: 'bank_deposit',
  currency: 'EUR',
  freeCountPerUser: 3,
  used: 1,
  remaining: 2,
  startsAt: '2026-11-15T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z',
  ...overrides,
});

describe('eurDepositPromotion', () => {
  it('finds the running euro deposit promotion with free deposits left', () => {
    expect(eurDepositPromotion({ promotions: [promotion()] }, NOW)?.id).toBe('promo-1');
  });

  it('ignores one the user has used up', () => {
    expect(eurDepositPromotion({ promotions: [promotion({ remaining: 0 })] }, NOW)).toBeNull();
  });

  it('ignores one outside its window', () => {
    expect(
      eurDepositPromotion({ promotions: [promotion({ endsAt: '2026-11-20T00:00:00.000Z' })] }, NOW),
    ).toBeNull();
    expect(
      eurDepositPromotion(
        { promotions: [promotion({ startsAt: '2026-11-21T00:00:00.000Z' })] },
        NOW,
      ),
    ).toBeNull();
  });

  it('ignores other scopes', () => {
    expect(eurDepositPromotion({ promotions: [promotion({ scope: 'fx' })] }, NOW)).toBeNull();
  });

  it('survives a missing or malformed response', () => {
    expect(eurDepositPromotion(undefined, NOW)).toBeNull();
    expect(eurDepositPromotion({ promotions: null } as never, NOW)).toBeNull();
    expect(eurDepositPromotion({ promotions: [promotion({ endsAt: 'soon' })] }, NOW)).toBeNull();
  });
});

describe('promotionLastDay', () => {
  it('is the day before an end at midnight, in UTC', () => {
    expect(promotionLastDay('2027-01-01T00:00:00.000Z')).toBe('31 Dec');
  });

  it('is the same day for an end during the day', () => {
    expect(promotionLastDay('2026-12-15T18:00:00.000Z')).toBe('15 Dec');
  });

  it('is empty for a date it cannot read', () => {
    expect(promotionLastDay('soon')).toBe('');
  });
});

describe('eurDepositPromotionCopy', () => {
  it('counts the free deposits left', () => {
    expect(eurDepositPromotionCopy(promotion())).toEqual({
      title: 'Your next 2 SEPA deposits are free',
      body: '€0 fee on them, whatever your plan. Offer ends 31 Dec.',
    });
  });

  it('speaks of one in the singular', () => {
    expect(eurDepositPromotionCopy(promotion({ remaining: 1 })).title).toBe(
      'Your next SEPA deposit is free',
    );
  });
});

describe('readBankDepositFee', () => {
  const fee = {
    amount: '0.00',
    currency: 'EUR',
    creditedAmount: '100.00',
    creditedToken: 'EURC',
    waiveReason: 'Promotion',
    waivedAmount: '0.50',
    promotion: { id: 'promo-1', name: 'Free SEPA deposits', slot: 1, freeCount: 3 },
  };

  it('reads the summary the payout wrote', () => {
    expect(readBankDepositFee({ source: 'wirex_bank', fee })).toEqual(fee);
  });

  it('is null for a deposit with no fee summary', () => {
    expect(readBankDepositFee({ source: 'wirex_bank' })).toBeNull();
    expect(readBankDepositFee(undefined)).toBeNull();
  });

  it('refuses an amount it cannot show', () => {
    expect(readBankDepositFee({ fee: { ...fee, amount: '-1' } })).toBeNull();
    expect(readBankDepositFee({ fee: { ...fee, amount: 0.5 } })).toBeNull();
  });

  it('drops a malformed promotion rather than the fee', () => {
    const read = readBankDepositFee({ fee: { ...fee, promotion: { id: 'promo-1' } } });
    expect(read?.amount).toBe('0.00');
    expect(read?.promotion).toBeUndefined();
  });
});

describe('bankDepositFeeLine', () => {
  const base = { currency: 'EUR', creditedAmount: '99.50', creditedToken: 'EURC' };

  it('shows the fee that was taken', () => {
    expect(bankDepositFeeLine({ ...base, amount: '0.50' })).toEqual({ value: '€0.50' });
  });

  it('shows €0.00 on a free deposit, which one it was, and what it saved', () => {
    expect(
      bankDepositFeeLine({
        ...base,
        amount: '0.00',
        waiveReason: 'Promotion',
        waivedAmount: '0.50',
        promotion: { id: 'promo-1', slot: 2, freeCount: 3 },
      }),
    ).toEqual({ value: '€0.00', note: 'Free deposit 2 of 3 · you saved €0.50' });
  });

  it('says a free deposit is free even without the promotion details', () => {
    expect(bankDepositFeeLine({ ...base, amount: '0.00', waiveReason: 'Promotion' })).toEqual({
      value: '€0.00',
      note: 'Free deposit',
    });
  });

  it('credits the plan on Ultra', () => {
    expect(bankDepositFeeLine({ ...base, amount: '0.00', waiveReason: 'TierFree' })).toEqual({
      value: '€0.00',
      note: 'Free on your plan',
    });
  });

  it('says nothing more on a fee below the minimum', () => {
    expect(bankDepositFeeLine({ ...base, amount: '0.00', waiveReason: 'BelowMinimum' })).toEqual({
      value: '€0.00',
    });
  });
});

describe('formatFiat', () => {
  it('uses the symbol when it has one', () => {
    expect(formatFiat('1.00', 'eur')).toBe('€1.00');
    expect(formatFiat('1.00', 'CHF')).toBe('1.00 CHF');
  });
});
