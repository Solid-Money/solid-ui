import {
  CardTransaction,
  CardTransactionCategory,
  Cashback,
  CashbackStatus,
  CashbackType,
} from '@/lib/types';
import {
  buildSpendingInsights,
  getMonthOverMonthChange,
  getSpendingCategory,
  getTransactionUsdAmount,
} from '@/lib/utils/spendingInsights';

// Local times, so month and day boundaries match what the screen will show.
const NOW = new Date(2026, 8, 26, 12).getTime(); // Sep 26 2026
const at = (month: number, day: number) => new Date(2026, month, day, 10).toISOString();

const tx = (overrides: Partial<CardTransaction>): CardTransaction =>
  ({
    id: 'tx',
    category: CardTransactionCategory.PURCHASE,
    status: 'settled',
    amount: '10.00',
    currency: 'USD',
    authorized_at: at(8, 10),
    posted_at: at(8, 11),
    related_transaction_ids: [],
    ...overrides,
  }) as CardTransaction;

const cb = (overrides: Partial<Cashback>): Cashback =>
  ({
    _id: 'cb',
    transactionId: 'tx',
    status: CashbackStatus.Escrowed,
    createdAt: at(8, 12),
    ...overrides,
  }) as Cashback;

const build = (
  transactions: CardTransaction[],
  cashbacks: Cashback[] = [],
  historyComplete = true,
) => buildSpendingInsights(transactions, cashbacks, { now: NOW, monthsBack: 2, historyComplete });

describe('buildSpendingInsights', () => {
  it('adds up purchases, nets refunds and ignores declined and reversed rows', () => {
    const { months } = build([
      tx({ id: 'a', amount: '40.00' }),
      tx({ id: 'b', amount: '25.50' }),
      tx({ id: 'r', category: CardTransactionCategory.REFUND, amount: '-5.50' }),
      tx({ id: 'd', amount: '100', status: 'declined' }),
      tx({ id: 'v', amount: '100', status: 'reversed' }),
    ]);
    const september = months[months.length - 1];

    expect(september.key).toBe('2026-09');
    expect(september.total).toBe(60);
    expect(september.purchaseCount).toBe(2);
  });

  it('counts a row once when the same transaction arrives on two pages', () => {
    const { months } = build([tx({ id: 'a', amount: '40' }), tx({ id: 'a', amount: '40' })]);

    expect(months[months.length - 1].total).toBe(40);
  });

  it('prices a foreign-currency charge by its dollar value', () => {
    expect(getTransactionUsdAmount({ amount: '50.00', currency: 'EUR', usd_amount: '54.20' })).toBe(
      54.2,
    );
    expect(getTransactionUsdAmount({ amount: '20', currency: 'usdc' })).toBe(20);
  });

  it('puts a purchase in the month and day it was made', () => {
    const { months } = build([
      tx({ id: 'aug', amount: '30', authorized_at: at(7, 31), status: 'approved' }),
      tx({ id: 'sep', amount: '12', authorized_at: at(8, 3), status: 'approved' }),
    ]);
    const august = months.find(month => month.key === '2026-08')!;
    const september = months.find(month => month.key === '2026-09')!;

    expect(august.total).toBe(30);
    expect(september.daily[2]).toBe(12);
    expect(september.daily).toHaveLength(30);
  });

  it('groups by category, largest first and Other last', () => {
    const { months } = build([
      tx({ id: 'food', amount: '50', merchant_category_code: '5812' }),
      tx({ id: 'shop', amount: '30', merchant_category_label: 'Online Shopping' }),
      tx({ id: 'misc', amount: '80', merchant_category_code: '6011' }),
    ]);
    const categories = months[months.length - 1].categories;

    expect(categories.map(category => category.key)).toEqual(['food', 'shopping', 'other']);
    expect(categories.map(category => category.percent)).toEqual([31, 19, 50]);
  });

  it('treats a charge that earned subscription cashback as a subscription', () => {
    const subscription = tx({ id: 'gpt', amount: '20', merchant_category_code: '5812' });

    expect(getSpendingCategory(subscription, new Set(['gpt']))).toBe('subscriptions');
  });

  it('credits cashback to the month of the purchase and lists subscription cashback', () => {
    const { months } = build(
      [
        tx({ id: 'gpt', amount: '20', merchant_name: 'OPENAI *CHATGPT' }),
        tx({ id: 'food', amount: '50' }),
      ],
      [
        cb({
          transactionId: 'gpt',
          type: CashbackType.SubscriptionDiscount,
          subscriptionCategory: 'ai',
          merchantName: 'OpenAI',
          projectedUsdValue: 2,
        }),
        cb({ transactionId: 'food', projectedUsdValue: 1.5 }),
        cb({ transactionId: 'gone', status: CashbackStatus.Ineligible, projectedUsdValue: 9 }),
      ],
    );
    const september = months[months.length - 1];

    expect(september.cashbackUsd).toBe(3.5);
    expect(september.subscriptionCashback).toEqual([
      { transactionId: 'gpt', merchant: 'OpenAI', category: 'ai', amountUsd: 2 },
    ]);
    expect(september.subscriptionCategoriesUsed).toEqual(['ai']);
  });

  it('only reports months the loaded history fully covers', () => {
    // Only this month's rows were read and more pages exist: August is unknown.
    const partial = build([tx({ id: 'a' })], [], false);
    expect(partial.months.map(month => month.key)).toEqual(['2026-09']);
    expect(partial.firstPurchaseMonthKey).toBeUndefined();

    // The whole history was read, so September is known to be the first month.
    const complete = build([tx({ id: 'a' })], [], true);
    expect(complete.months.map(month => month.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(complete.firstPurchaseMonthKey).toBe('2026-09');
  });

  it('says there is no purchase at all for a card with none', () => {
    const insights = build([]);

    expect(insights.hasAnyPurchase).toBe(false);
    expect(insights.months[insights.months.length - 1].total).toBe(0);
  });
});

describe('getMonthOverMonthChange', () => {
  it('compares against the previous month, and needs one to compare against', () => {
    const month = (total: number) => ({ total }) as Parameters<typeof getMonthOverMonthChange>[0];

    expect(getMonthOverMonthChange(month(88), month(100))).toBe(-12);
    expect(getMonthOverMonthChange(month(50), month(0))).toBeNull();
    expect(getMonthOverMonthChange(month(50), undefined)).toBeNull();
  });
});

describe('purchase dates', () => {
  it('dates a settled purchase by when it was made, not when it settled', () => {
    const { months } = buildSpendingInsights(
      [tx({ id: 'late', amount: '25', authorized_at: at(7, 31), posted_at: at(8, 2) })],
      [],
      { now: NOW, monthsBack: 2, historyComplete: true },
    );

    expect(months.find(month => month.key === '2026-08')!.total).toBe(25);
    expect(months.find(month => month.key === '2026-09')!.total).toBe(0);
  });
});

describe('subscriptions', () => {
  it('recognises a subscription by service name or digital-goods code', () => {
    expect(getSpendingCategory(tx({ id: 'n', merchant_name: 'NETFLIX.COM 866-579' }))).toBe(
      'subscriptions',
    );
    // 5815 used to fall in the 5800s restaurant range.
    expect(getSpendingCategory(tx({ id: 'd', merchant_category_code: '5815' }))).toBe(
      'subscriptions',
    );
    expect(getSpendingCategory(tx({ id: 'b', merchant_name: 'Burger Bar' }))).toBe('other');
  });

  it('lists each service once, with the cashback it actually earned', () => {
    const { months } = buildSpendingInsights(
      [
        tx({ id: 'gpt', amount: '20', merchant_name: 'OPENAI *CHATGPT SUBSCR' }),
        tx({ id: 'nf', amount: '15.49', merchant_name: 'NETFLIX.COM', authorized_at: at(8, 11) }),
        tx({ id: 'app', amount: '4.99', merchant_category_code: '5817', merchant_name: 'NOTION' }),
        tx({ id: 'food', amount: '50', merchant_category_code: '5812' }),
      ],
      [
        cb({
          transactionId: 'gpt',
          type: CashbackType.SubscriptionDiscount,
          subscriptionCategory: 'ai',
          projectedUsdValue: 2,
        }),
      ],
      { now: NOW, monthsBack: 2, historyComplete: true },
    );
    const subscriptions = months[months.length - 1].subscriptions;

    expect(
      subscriptions.map(item => [
        item.merchant,
        item.brand,
        item.category,
        item.amountUsd,
        item.cashbackUsd,
      ]),
    ).toEqual([
      ['OpenAI', 'OpenAI', 'ai', 20, 2],
      ['Netflix', 'Netflix', 'streaming', 15.49, 0],
      ['NOTION', undefined, undefined, 4.99, 0],
    ]);
  });
});
