/// <reference types="jest" />

import {
  chooseDeclineFix,
  declinedPaymentFigures,
  formatCardCurrency,
  roundUpShortfall,
  shortfallOf,
  spendableDisplay,
} from '@/lib/utils/cardCurrency';

const EUR_SPENDABLE = {
  available: { amount: '14.46', currency: 'usd' as const },
  available_in_card_currency: {
    amount: '12.73',
    currency: 'EUR',
    rate: 1.1358,
    rate_at: '2026-10-15T08:00:00.000Z',
  },
};

describe('formatCardCurrency', () => {
  it('writes balances with two places', () => {
    expect(formatCardCurrency(983.47, 'EUR')).toBe('€983.47');
    expect(formatCardCurrency(1120, 'USD')).toBe('$1,120.00');
  });

  it('writes nothing at all as €0 in a sentence', () => {
    expect(formatCardCurrency(0, 'EUR', { wholeZero: true })).toBe('€0');
    expect(formatCardCurrency(0, 'EUR')).toBe('€0.00');
  });

  it('drops the cents from a round figure to tap', () => {
    expect(formatCardCurrency(20, 'EUR', { trimWhole: true })).toBe('€20');
    expect(formatCardCurrency(20.5, 'EUR', { trimWhole: true })).toBe('€20.50');
  });
});

describe('spendableDisplay', () => {
  it("shows the card's own currency, with the dollars it came from", () => {
    expect(spendableDisplay(EUR_SPENDABLE)).toEqual({
      label: '€12.73',
      amount: 12.73,
      currency: 'EUR',
      usdEquivalent: 14.46,
    });
  });

  it('has nothing to say for a dollar card', () => {
    expect(spendableDisplay({ available: { amount: '14.46' } })).toBeUndefined();
  });
});

describe('roundUpShortfall', () => {
  it('offers a round figure at least the gap', () => {
    expect(roundUpShortfall(18.75)).toBe(20);
    expect(roundUpShortfall(0.07)).toBe(5);
    expect(roundUpShortfall(20)).toBe(20);
    expect(roundUpShortfall(0)).toBe(0);
  });
});

describe('declinedPaymentFigures', () => {
  it("compares the billed euros with what the card can spend in euros (Oct 15's 7¢ case)", () => {
    const figures = declinedPaymentFigures(
      {
        amount: '12.80',
        currency: 'EUR',
        spend_details: { card_amount: '12.80', card_currency: 'EUR' },
      },
      EUR_SPENDABLE,
    );

    expect(figures.payment).toEqual({ amount: 12.8, currency: 'EUR' });
    expect(figures.available).toEqual({ amount: 12.73, currency: 'EUR' });
    expect(shortfallOf(figures.comparable!)).toBe(0.07);
  });

  it('uses what Wirex billed the card, not the merchant total, for a foreign shop', () => {
    // A BRL shop, billed to the euro card in euros.
    const figures = declinedPaymentFigures(
      {
        amount: '119.45',
        currency: 'BRL',
        spend_details: { card_amount: '21.28', card_currency: 'EUR' },
      },
      EUR_SPENDABLE,
    );

    expect(figures.payment).toEqual({ amount: 21.28, currency: 'EUR' });
    expect(figures.comparable?.currency).toBe('EUR');
  });

  it('compares dollars for a payment billed in dollars', () => {
    const figures = declinedPaymentFigures({ amount: '25.00', currency: 'USD' }, EUR_SPENDABLE);

    expect(figures.available).toEqual({ amount: 14.46, currency: 'USD' });
    expect(figures.comparable).toMatchObject({ payment: 25, available: 14.46, rateToUsd: 1 });
  });

  it('falls back to the dollar value when the payment is in neither currency', () => {
    const figures = declinedPaymentFigures(
      { amount: '410.00', currency: 'THB', usd_amount: '11.60' },
      EUR_SPENDABLE,
    );

    expect(figures.available).toEqual({ amount: 12.73, currency: 'EUR' });
    expect(figures.comparable).toMatchObject({ payment: 11.6, available: 14.46, currency: 'USD' });
  });

  it('has only the payment until the balance has been read', () => {
    expect(declinedPaymentFigures({ amount: '18.75', currency: 'EUR' }, undefined)).toEqual({
      payment: { amount: 18.75, currency: 'EUR' },
    });
  });
});

describe('chooseDeclineFix', () => {
  const euroPayment = { amount: 18.75, currency: 'EUR' };

  it('turns on euro spending when their EURC covers a euro payment', () => {
    expect(
      chooseDeclineFix({ payment: euroPayment, merchantCurrency: 'EUR', unusableEurc: 229.79 }),
    ).toBe('turn_on_euro');
  });

  it('does not, when the EURC falls short — it would decline again', () => {
    expect(
      chooseDeclineFix({ payment: euroPayment, merchantCurrency: 'EUR', unusableEurc: 10 }),
    ).toBe('add_funds');
  });

  it('does not, for a foreign shop the euro balance cannot pay', () => {
    expect(
      chooseDeclineFix({ payment: euroPayment, merchantCurrency: 'BRL', unusableEurc: 229.79 }),
    ).toBe('add_funds');
  });

  it('offers a swap of a holding worth the gap', () => {
    expect(
      chooseDeclineFix({
        payment: euroPayment,
        merchantCurrency: 'EUR',
        unusableEurc: 0,
        swapValueUsd: 1_200,
        shortfallUsd: 21.4,
      }),
    ).toBe('swap');
  });

  it('adds funds when the holding is worth less than the gap', () => {
    expect(
      chooseDeclineFix({
        payment: euroPayment,
        merchantCurrency: 'EUR',
        unusableEurc: 0,
        swapValueUsd: 5,
        shortfallUsd: 21.4,
      }),
    ).toBe('add_funds');
  });
});
