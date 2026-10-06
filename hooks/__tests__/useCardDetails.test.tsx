import React from 'react';

import { useCardDetails } from '@/hooks/useCardDetails';
import { CardProvider } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
let mockProvider: CardProvider;
let mockDetails: any;
let mockBalance: any;
let model: ReturnType<typeof useCardDetails>;
let root: any;
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => (queryKey[0] === 'cardBalance' ? mockBalance : mockDetails),
}));
jest.mock('@/hooks/cardDetailsQueryOptions', () => ({
  cardDetailsQueryOptions: () => ({ queryKey: ['cardDetails'] }),
  cardBalanceQueryKey: (userId: string) => ['cardBalance', userId],
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: any) => selector({ users: [{ selected: true, userId: 'account-a' }] }),
}));
jest.mock('@/lib/api', () => ({ getCardBalance: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  formatCentsToDollars: (amount: number) => String(amount / 100),
  withRefreshToken: jest.fn(),
}));
function Probe() {
  const value = useCardDetails();
  React.useEffect(() => {
    model = value;
  }, [value]);
  return null;
}
beforeEach(() => {
  mockProvider = CardProvider.RAIN;
  mockDetails = {
    data: { balances: { available: { amount: '999' } } },
    isLoading: false,
    isError: false,
    error: null,
  };
  mockBalance = { data: { spendingPower: 10000 }, isLoading: false, isError: false, error: null };
  act(() => {
    root = create(<Probe />);
  });
});
afterEach(() => {
  act(() => root.unmount());
});
it('uses the separate live Rain balance rather than the older card details amount', () => {
  expect(model.data?.balances.available?.amount).toBe('100');
});
it('reports a failed Rain balance read even when card metadata is available', () => {
  mockBalance = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('Balance unavailable'),
  };
  act(() => root.update(<Probe />));
  expect(model.isError).toBe(true);
  expect(model.error).toBe(mockBalance.error);
});
it('ignores a stale Rain-only balance error after the issuer resolves to Wirex', () => {
  mockProvider = CardProvider.WIREX;
  mockBalance = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('Rain balance unsupported'),
  };
  act(() => root.update(<Probe />));
  expect(model.isError).toBe(false);
  expect(model.error).toBeNull();
  expect(model.data?.balances.available?.amount).toBe('999');
});
