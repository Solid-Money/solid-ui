import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { refreshAccountQueries } from '@/lib/refreshAccountQueries';

describe('shared manual and live balance invalidation', () => {
  it('refreshes wallet, card, savings and status reads without touching another account or unrelated content', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const keys = [
      ['tokenBalances', '0xABC'],
      ['vault', 'balance', '0xabc', 'USDC'],
      ['cardStatus', 'account'],
      ['cardDetails', 'account'],
      ['cardBalance', 'account'],
      ['user-transactions', '0xabc', 'usdc'],
      ['vaultExchangeRate', 'USDC'],
      ['readContract', { functionName: 'balanceOf', args: ['0xabc'] }],
      ['readContract', { functionName: 'getRate', address: '0xaccountant' }],
      ['cardTransactions'],
      ['portfolioCustody', 'account', '0xABC', 'lock', 'credit-module'],
      ['tierMembership', 'account'],
      ['layerZeroStatus', 'hash'],
      ['tokenBalances', '0xDEF'],
      ['cardDetails', 'other-account'],
      ['whats-new'],
    ];
    const fetches = keys.map(() => jest.fn(async () => 'fresh'));
    const unsubscribers = keys.map((queryKey, index) =>
      new QueryObserver(client, {
        queryKey,
        queryFn: fetches[index],
        initialData: 'cached',
        staleTime: Infinity,
      }).subscribe(() => {}),
    );
    await refreshAccountQueries(client, 'account', '0xABC', true);
    fetches.slice(0, 13).forEach(fetch => expect(fetch).toHaveBeenCalledTimes(1));
    fetches.slice(13).forEach(fetch => expect(fetch).not.toHaveBeenCalled());
    unsubscribers.forEach(unsubscribe => unsubscribe());
    client.clear();
  });
});
