import React from 'react';

import MonthlySummaryCard from '@/components/Activity/MonthlySummaryCard';
import InsightsScreen from '@/components/Insights/InsightsScreen';
import { CardTransaction, CardTransactionCategory, Cashback } from '@/lib/types';
import { buildSpendingInsights } from '@/lib/utils/spendingInsights';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock(
  '@/components/PageLayout',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children,
);
jest.mock('@/components/ui/back-button', () => ({ BackButton: () => null }));
jest.mock('@/components/ui/skeleton', () => () => null);
jest.mock('@/components/Rewards/NewRewards/SubscriptionBrandBadge', () => () => null);
const mockRedirect = jest.fn();
let mockParams: { month?: string; category?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

const mockInsights = jest.fn();
jest.mock('@/hooks/useSpendingInsights', () => ({
  useSpendingInsights: () => mockInsights(),
}));

const NOW = new Date(2026, 8, 26, 12).getTime();
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

const useInsights = (transactions: CardTransaction[], cashbacks: Cashback[] = []) =>
  mockInsights.mockReturnValue({
    ...buildSpendingInsights(transactions, cashbacks, {
      now: NOW,
      monthsBack: 2,
      historyComplete: true,
    }),
    currentMonth: undefined,
    subscriptionCategoryLimit: 2,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });

const textOf = (element: React.ReactElement): string[] => {
  let tree: any;
  act(() => {
    tree = create(element);
  });
  const texts = tree.root
    .findAllByType('Text')
    .map((node: any) => [].concat(node.props.children).filter(Boolean).join(''));
  act(() => tree.unmount());
  return texts;
};

describe('InsightsScreen', () => {
  afterEach(() => {
    mockParams = {};
  });

  it('shows the month picked by the chart, its change and its categories', () => {
    useInsights([
      tx({ id: 'aug', amount: '100', authorized_at: at(7, 12), merchant_category_code: '5812' }),
      tx({ id: 'food', amount: '50', merchant_category_code: '5812' }),
      tx({ id: 'shop', amount: '38', merchant_category_label: 'Online Shopping' }),
    ]);
    const texts = textOf(<InsightsScreen />);

    expect(texts).toEqual(
      expect.arrayContaining([
        'Spent in September',
        '$88.00',
        '12% vs August',
        'Aug',
        'Sep',
        'September by category',
        'Food & Drink',
        'Shopping',
      ]),
    );
  });

  it('shows the first month by day, with no comparison yet', () => {
    useInsights([tx({ id: 'a', amount: '20' })]);
    const texts = textOf(<InsightsScreen />);

    expect(texts).toEqual(
      expect.arrayContaining([
        'Your first month with Solid',
        'Month-by-month comparison starts in October',
        'Sep 1',
        'Sep 30',
      ]),
    );
    expect(texts).not.toContain('Aug');
  });

  it('lists subscriptions, and says they are tracked when there are none', () => {
    useInsights([tx({ id: 'nf', amount: '15.49', merchant_name: 'NETFLIX.COM' })]);
    expect(textOf(<InsightsScreen />)).toEqual(
      expect.arrayContaining(['Subscriptions', 'Netflix', 'Streaming · Charged Sep 10']),
    );

    useInsights([tx({ id: 'food', amount: '20', merchant_category_code: '5812' })]);
    expect(textOf(<InsightsScreen />)).toEqual(
      expect.arrayContaining(['Subscriptions', 'No subscriptions in September']),
    );
  });

  it('only invites people to add subscriptions in the current month', () => {
    const invite = (texts: string[]) => texts.some(text => text.startsWith('Pay for Netflix'));

    // The test clock's real "now" is not September 2026, so build both cases
    // against today's month.
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2, 10).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 2, 10).toISOString();
    const current = (authorizedAt: string) =>
      mockInsights.mockReturnValue({
        ...buildSpendingInsights(
          [tx({ id: 'food', amount: '20', authorized_at: authorizedAt, posted_at: authorizedAt })],
          [],
          { monthsBack: 2, historyComplete: true },
        ),
        currentMonth: undefined,
        subscriptionCategoryLimit: 0,
        subscriptionDiscountRate: 0,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

    current(thisMonth);
    expect(invite(textOf(<InsightsScreen />))).toBe(true);

    current(lastMonth);
    expect(invite(textOf(<InsightsScreen />))).toBe(false);
  });

  it('opens on the newest month with spend', () => {
    useInsights([
      tx({ id: 'jul', amount: '40', authorized_at: at(6, 12) }),
      tx({ id: 'aug', amount: '30', authorized_at: at(7, 12) }),
    ]);

    expect(textOf(<InsightsScreen />)).toEqual(
      expect.arrayContaining(['Spent in August', '$30.00', 'August by category']),
    );
  });

  it("opens on a transaction's month when its Category row sent us here", () => {
    useInsights([
      tx({ id: 'jul', amount: '40', authorized_at: at(6, 12) }),
      tx({ id: 'aug', amount: '30', authorized_at: at(7, 12) }),
    ]);
    mockParams = { month: '2026-07', category: 'other' };

    expect(textOf(<InsightsScreen />)).toEqual(
      expect.arrayContaining(['Spent in July', '$40.00', 'July by category']),
    );
  });

  it('ignores a month param it has no data for', () => {
    useInsights([tx({ id: 'aug', amount: '30', authorized_at: at(7, 12) })]);
    mockParams = { month: '2025-01', category: 'not-a-category' };

    expect(textOf(<InsightsScreen />)).toEqual(expect.arrayContaining(['Spent in August']));
  });

  it('sends a card with no purchases back to Activity instead of an empty screen', () => {
    useInsights([tx({ id: 'declined', status: 'declined' })]);

    expect(textOf(<InsightsScreen />)).toEqual([]);
    expect(mockRedirect).toHaveBeenCalledWith('/activity');
  });
});

describe('MonthlySummaryCard', () => {
  it('summarises this month over the Activity feed', () => {
    useInsights([tx({ id: 'food', amount: '50', merchant_category_code: '5812' })]);

    expect(textOf(<MonthlySummaryCard />)).toEqual(
      expect.arrayContaining(['Spent in September', 'Insights', '$50.00', 'Food & Drink', '100%']),
    );
  });

  it('shows last month when nothing has been spent yet this month', () => {
    useInsights([tx({ id: 'aug', amount: '30', authorized_at: at(7, 12) })]);

    expect(textOf(<MonthlySummaryCard />)).toEqual(
      expect.arrayContaining(['Spent in August', '$30.00']),
    );
  });

  it('stays hidden for a card with no purchases', () => {
    useInsights([tx({ id: 'declined', amount: '30', status: 'declined' })]);

    expect(textOf(<MonthlySummaryCard />)).toEqual([]);
  });
});
