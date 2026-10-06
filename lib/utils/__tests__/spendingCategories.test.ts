import { getMccCategory, getSpendingCategory } from '@/lib/utils/spendingCategories';

import type { CardTransaction } from '@/lib/types';

const purchase = (
  fields: Partial<
    Pick<
      CardTransaction,
      'merchant_category_code' | 'merchant_category_label' | 'merchant_name' | 'description'
    >
  >,
) => getSpendingCategory({ id: 'tx', description: '', ...fields });

describe('getMccCategory', () => {
  it.each([
    ['5812', 'food'],
    ['5814', 'food'],
    ['5462', 'food'],
    ['5411', 'groceries'],
    ['5921', 'groceries'],
    ['5311', 'shopping'],
    ['5999', 'shopping'],
    ['4121', 'transport'],
    ['7523', 'transport'],
    ['3058', 'transport'],
    ['7011', 'transport'],
    ['5541', 'transport'],
    ['5818', 'subscriptions'],
    ['5734', 'subscriptions'],
    ['4899', 'subscriptions'],
    ['7832', 'entertainment'],
    ['5816', 'entertainment'],
    ['7995', 'entertainment'],
    ['5912', 'health'],
    ['8011', 'health'],
    ['7230', 'health'],
    ['7997', 'health'],
    ['4814', 'bills'],
    ['4900', 'bills'],
    ['6300', 'bills'],
    ['9311', 'bills'],
    ['6011', 'transfers'],
    ['6051', 'transfers'],
    ['4829', 'transfers'],
    ['6540', 'transfers'],
    ['7311', 'business'],
    ['7399', 'business'],
    ['8999', 'business'],
    ['8299', 'bills'],
    ['8111', 'business'],
    ['7349', 'bills'],
    ['8398', 'other'],
    ['742', 'other'],
  ])('%s → %s', (code, category) => {
    expect(getMccCategory(code)).toBe(category);
  });

  it('has nothing to say without a numeric code', () => {
    expect(getMccCategory(undefined)).toBeUndefined();
    expect(getMccCategory('')).toBeUndefined();
    expect(getMccCategory('Online Shopping')).toBeUndefined();
  });
});

describe('getSpendingCategory', () => {
  it('puts food delivery under food whatever code it was billed under', () => {
    expect(purchase({ merchant_name: 'UBER *EATS PENDING', merchant_category_code: '4121' })).toBe(
      'food',
    );
    expect(purchase({ merchant_name: 'Wolt', merchant_category_code: '5499' })).toBe('food');
    expect(purchase({ merchant_name: 'BOLT FOOD', merchant_category_code: '4121' })).toBe('food');
    // The ride itself stays a ride.
    expect(purchase({ merchant_name: 'UBER *TRIP', merchant_category_code: '4121' })).toBe(
      'transport',
    );
  });

  it('trusts a specific code over the merchant name', () => {
    expect(purchase({ merchant_name: 'COSTCO GAS #123', merchant_category_code: '5542' })).toBe(
      'transport',
    );
    expect(purchase({ merchant_name: 'Hotel Bar', merchant_category_code: '5813' })).toBe('food');
  });

  it('lets a merchant name override a catch-all code', () => {
    expect(purchase({ merchant_name: 'SUSHI KING', merchant_category_code: '5999' })).toBe('food');
    expect(purchase({ merchant_name: 'BINANCE', merchant_category_code: '7399' })).toBe(
      'transfers',
    );
    expect(purchase({ merchant_name: 'City Parking', merchant_category_code: '7299' })).toBe(
      'transport',
    );
    // Nothing better known: the catch-all still places it.
    expect(purchase({ merchant_name: 'ACME LTD', merchant_category_code: '5999' })).toBe(
      'shopping',
    );
  });

  it('names subscription services that bill under other codes', () => {
    expect(purchase({ merchant_name: 'APPLE.COM/BILL', merchant_category_code: '5735' })).toBe(
      'subscriptions',
    );
    expect(purchase({ merchant_name: 'NOTION LABS', merchant_category_code: '7399' })).toBe(
      'subscriptions',
    );
  });

  it('places the merchants our own card data shows mis-coded', () => {
    // Game top-ups and in-app coins bill under software and digital-app codes.
    expect(
      purchase({ merchant_name: 'GOOGLE *eFootball 2024', merchant_category_code: '5734' }),
    ).toBe('entertainment');
    expect(purchase({ merchant_name: 'PUBGMobile', merchant_category_code: '5816' })).toBe(
      'entertainment',
    );
    expect(purchase({ merchant_name: 'TikTok', merchant_category_code: '5817' })).toBe(
      'entertainment',
    );
    // A wallet top-up under an insurance code, and a marketplace under a grocery one.
    expect(purchase({ merchant_name: 'Tinaba', merchant_category_code: '6300' })).toBe('transfers');
    expect(purchase({ merchant_name: 'Lazada', merchant_category_code: '5499' })).toBe('shopping');
    expect(purchase({ merchant_name: 'Meituan - Alipay', merchant_category_code: '5999' })).toBe(
      'food',
    );
    expect(purchase({ merchant_name: 'DiDi Chuxing', merchant_category_code: '7372' })).toBe(
      'transport',
    );
    // Ad spend is business spend, and TikTok's ads are not TikTok coins.
    expect(purchase({ merchant_name: 'FACEBK *22DPQ76HL4', merchant_category_code: '7311' })).toBe(
      'business',
    );
    expect(purchase({ merchant_name: 'TikTok Ads', merchant_category_code: '5817' })).toBe(
      'business',
    );
  });

  it('reads Wirex category names when there is no code', () => {
    expect(purchase({ merchant_category_label: 'Restaurants' })).toBe('food');
    expect(purchase({ merchant_category_label: 'Groceries' })).toBe('groceries');
    expect(purchase({ merchant_category_label: 'Online Shopping' })).toBe('shopping');
    expect(purchase({ merchant_category_label: 'Transport' })).toBe('transport');
    expect(purchase({ merchant_category_label: 'Entertainment' })).toBe('entertainment');
    expect(purchase({ merchant_category_label: 'Health & Beauty' })).toBe('health');
    expect(purchase({ merchant_category_label: 'Beauty shop' })).toBe('health');
    expect(purchase({ merchant_category_label: 'Sporting goods store' })).toBe('shopping');
    expect(purchase({ merchant_category_label: 'Utilities' })).toBe('bills');
    expect(purchase({ merchant_category_label: 'Money transfer' })).toBe('transfers');
    // Wirex's own vocabulary, as it arrives on our purchases.
    expect(purchase({ merchant_category_label: 'Eating out' })).toBe('food');
    expect(purchase({ merchant_category_label: 'Holidays' })).toBe('transport');
    expect(purchase({ merchant_category_label: 'Cash' })).toBe('transfers');
    expect(purchase({ merchant_category_label: 'Bills' })).toBe('bills');
    expect(purchase({ merchant_category_label: 'General' })).toBe('other');
    expect(purchase({ merchant_category_label: 'Advertising' })).toBe('business');
  });

  it('prefers a known merchant over a vague Wirex name', () => {
    expect(purchase({ merchant_name: 'Binance', merchant_category_label: 'Online Shopping' })).toBe(
      'transfers',
    );
    expect(purchase({ merchant_name: 'Starbucks', merchant_category_label: 'Services' })).toBe(
      'food',
    );
  });

  it('falls back to words in the merchant name', () => {
    expect(purchase({ merchant_name: 'Cafe Nero Tel Aviv' })).toBe('food');
    expect(purchase({ merchant_name: 'PIZZERIA DA MARIO' })).toBe('food');
    expect(purchase({ merchant_name: 'Nail Bar Studio' })).toBe('health');
    expect(purchase({ merchant_name: 'SUPER-PHARM 123' })).toBe('health');
    expect(purchase({ merchant_name: 'Central Bus Station' })).toBe('transport');
    expect(purchase({ merchant_name: 'Train tickets' })).toBe('transport');
    expect(purchase({ merchant_name: 'Cinema City Glilot' })).toBe('entertainment');
    expect(purchase({ merchant_name: 'Pet Shop' })).toBe('shopping');
  });

  it('matches whole words only', () => {
    // "bar" inside "barnes", "deli" inside "delivery", "cab" inside "cabinet".
    expect(purchase({ merchant_name: 'Barnes Holdings' })).toBe('other');
    expect(purchase({ merchant_name: 'Delivery Fee' })).toBe('other');
    expect(purchase({ merchant_name: 'Cabinet Makers' })).toBe('other');
  });

  it('leaves a purchase nothing recognises in Other', () => {
    expect(purchase({ merchant_name: 'XYZ 4417' })).toBe('other');
    expect(purchase({ merchant_name: 'Red Cross', merchant_category_code: '8398' })).toBe('other');
  });
});
