/// <reference types="jest" />
import { CardTransaction, CardTransactionCategory } from '@/lib/types';
import {
  getCardRefundLabel,
  getPurchaseRefundId,
  getRefundedPurchaseId,
} from '@/lib/utils/cardHelpers';

const HOTEL_ID = 'd3dc874f-e5f3-4b07-8539-065c8559a924';
const REFUND_ID = `${HOTEL_ID}-refund`;

const row = (overrides: Partial<CardTransaction>): CardTransaction =>
  ({
    id: HOTEL_ID,
    category: CardTransactionCategory.PURCHASE,
    amount: '5150.00',
    currency: 'CNY',
    status: 'settled',
    related_transaction_ids: [],
    ...overrides,
  }) as CardTransaction;

/** A CNY hotel deposit refunded in full, as the backend lists it now. */
const purchase = row({ refunded_amount: '5150.00', related_transaction_ids: [REFUND_ID] });
const refund = row({
  id: REFUND_ID,
  category: CardTransactionCategory.REFUND,
  amount: '-5150.00',
  related_transaction_ids: [HOTEL_ID],
});

describe('refund links', () => {
  it('links a refund row to its purchase, and the purchase back', () => {
    expect(getRefundedPurchaseId(refund)).toBe(HOTEL_ID);
    expect(getPurchaseRefundId(purchase)).toBe(REFUND_ID);
  });

  it('links nothing on a plain purchase', () => {
    const plain = row({});

    expect(getRefundedPurchaseId(plain)).toBeUndefined();
    expect(getPurchaseRefundId(plain)).toBeUndefined();
  });

  it('does not read a purchase as refunded from a related id alone', () => {
    expect(getPurchaseRefundId(row({ related_transaction_ids: ['other'] }))).toBeUndefined();
  });
});

describe('getCardRefundLabel', () => {
  it('labels the refund row and the purchase it was for', () => {
    expect(getCardRefundLabel(refund)).toBe('Refund');
    expect(getCardRefundLabel(purchase)).toBe('Refunded');
  });

  it('says partially when part of the charge still stands', () => {
    expect(
      getCardRefundLabel(row({ refunded_amount: '150.00', related_transaction_ids: [REFUND_ID] })),
    ).toBe('Partially refunded');
  });

  it('reads the netted shape an older backend sends', () => {
    // Net of the refund: nothing left means all of it came back.
    expect(getCardRefundLabel(row({ amount: '0.00', refunded_amount: '5150.00' }))).toBe(
      'Refunded',
    );
    // 30 left after 40 came back: a 70 charge, partly refunded.
    expect(getCardRefundLabel(row({ amount: '30.00', refunded_amount: '40.00' }))).toBe(
      'Partially refunded',
    );
  });

  it('labels nothing that was not refunded', () => {
    expect(getCardRefundLabel(row({}))).toBeUndefined();
    expect(getCardRefundLabel(row({ refunded_amount: '0.00' }))).toBeUndefined();
  });
});
