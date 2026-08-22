/// <reference types="jest" />
import { CardTransaction, CardTransactionCategory } from '@/lib/types';
import { getMerchantDisplay } from '@/lib/utils/cardHelpers';

/**
 * Merchant enrichment is optional and never arrives before a transaction settles,
 * so every field has to fall back. These pin the order.
 */
describe('getMerchantDisplay', () => {
  const transaction = (overrides: Partial<CardTransaction> = {}): CardTransaction =>
    ({
      id: 'txn_1',
      card_account_id: 'card_1',
      customer_id: 'cust_1',
      category: CardTransactionCategory.PURCHASE,
      amount: '9.99',
      currency: 'usd',
      status: 'completed',
      description: '',
      posted_at: '2026-08-18T23:45:27.243Z',
      authorized_at: '2026-08-18T00:15:27.566Z',
      related_transaction_ids: [],
      ...overrides,
    }) as CardTransaction;

  it('shows the enriched brand name and logo when the issuer has them', () => {
    const merchant = getMerchantDisplay(
      transaction({
        merchant_name: 'GOOGLE *Play Books       ',
        merchant_city: 'g.co/helppay#',
        merchant_country: 'US',
        merchant_category: 'Book Stores',
        enriched_merchant_name: 'Google Play',
        enriched_merchant_icon: 'https://storage.googleapis.com/icons/mrc.png',
      }),
    );

    expect(merchant.name).toBe('Google Play');
    expect(merchant.iconUrl).toBe('https://storage.googleapis.com/icons/mrc.png');
    // No enriched category on that delivery, so the issuer's own category shows.
    expect(merchant.category).toBe('Book Stores');
    expect(merchant.location).toBe('g.co/helppay# US');
  });

  it('prefers the enriched category over the raw one', () => {
    const merchant = getMerchantDisplay(
      transaction({
        merchant_category: 'Book Stores',
        enriched_merchant_category: 'Digital Goods',
      }),
    );

    expect(merchant.category).toBe('Digital Goods');
  });

  it('falls back to the raw descriptor before settlement', () => {
    // An authorization never carries enrichment.
    const merchant = getMerchantDisplay(
      transaction({ merchant_name: 'GOOGLE *Play Books       ', status: 'approved' }),
    );

    expect(merchant.name).toBe('GOOGLE *Play Books');
    expect(merchant.iconUrl).toBeUndefined();
    expect(merchant.category).toBeUndefined();
  });

  it('ignores a blank enriched name', () => {
    const merchant = getMerchantDisplay(
      transaction({ merchant_name: 'NETFLIX.COM', enriched_merchant_name: '   ' }),
    );

    expect(merchant.name).toBe('NETFLIX.COM');
  });

  it('falls back to the description, then to Unknown', () => {
    expect(getMerchantDisplay(transaction({ description: 'Card funding' })).name).toBe(
      'Card funding',
    );
    expect(getMerchantDisplay(transaction()).name).toBe('Unknown');
  });

  it('formats the location the way each screen asks for', () => {
    const facts = transaction({ merchant_city: 'Seattle', merchant_country: 'US' });

    expect(getMerchantDisplay(facts).location).toBe('Seattle US');
    expect(
      getMerchantDisplay(facts, { locationSeparator: ', ', uppercaseLocation: true }).location,
    ).toBe('SEATTLE, US');
  });

  it('omits the location when the transaction carries no place', () => {
    expect(getMerchantDisplay(transaction()).location).toBeUndefined();
    expect(getMerchantDisplay(transaction({ merchant_city: '  ' })).location).toBeUndefined();
  });
});
