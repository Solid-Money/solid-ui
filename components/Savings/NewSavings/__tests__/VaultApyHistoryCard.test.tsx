import React from 'react';
import { useQueries } from '@tanstack/react-query';

import VaultApyHistoryCard from '@/components/Savings/NewSavings/VaultApyHistoryCard';
import { HistoricalAPYPoint, VaultType } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');

jest.mock('@tanstack/react-query', () => ({ useQueries: jest.fn() }));
jest.mock('lucide-react-native', () => ({ ChevronDown: 'ChevronDown' }));
jest.mock('@/components/BarChart', () => 'Chart');
jest.mock('@/components/Tooltip', () => 'Tooltip');
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Savings/NewSavings/SelectSheet', () => ({
  __esModule: true,
  default: ({ trigger }: { trigger: React.ReactElement }) => trigger,
}));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isDesktop: false }) }));
jest.mock('@/hooks/useAnalytics', () => ({
  DEFAULT_HISTORICAL_APY_DAYS: '7',
  historicalApyQueryOptions: (days: string) => ({ queryKey: [days] }),
  useAPYs: () => ({ data: {}, isLoading: false }),
}));
jest.mock('@/lib/utils', () => ({ cn: (...classes: string[]) => classes.join(' ') }));

let root: ReturnType<typeof create>;

const render = (histories: (HistoricalAPYPoint[] | undefined)[]) => {
  (useQueries as jest.Mock).mockImplementation(
    ({ queries }: { queries: { select: (history: HistoricalAPYPoint[]) => unknown }[] }) =>
      queries.map(({ select }, index) => {
        const history = histories[index];
        return { data: history && select(history), isLoading: history === undefined };
      }),
  );
  act(() => {
    root = create(<VaultApyHistoryCard vaultType={VaultType.USDC} />);
  });
};

afterEach(() => act(() => root.unmount()));

it('keeps a chart skeleton visible while history loads', () => {
  render([undefined, undefined, undefined]);
  expect(root.root.findByType('Skeleton')).toBeDefined();
});

it('chooses a period that still has a visible bar after resampling', () => {
  const sevenDay = Array.from({ length: 47 }, (_, index) => ({
    time: new Date(index * 60_000).toISOString(),
    value: index === 1 ? 5 : 0,
  }));
  const fifteenDay = [{ time: '2026-11-14T00:00:00Z', value: 3 }];
  render([sevenDay, fifteenDay, []]);

  expect(
    root.root.findAllByProps({ accessibilityLabel: 'Change APY period. Current period: 15D' }),
  ).not.toHaveLength(0);
  expect(root.root.findByType('Chart').props.data).toEqual(fifteenDay);
});

it('hides the card once all periods settle without chartable history', () => {
  render([[{ time: '2026-11-14T00:00:00Z', value: 0 }], [], []]);
  expect(root.toJSON()).toBeNull();
});
