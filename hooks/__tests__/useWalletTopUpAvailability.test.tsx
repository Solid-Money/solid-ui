import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useWalletTopUpAvailability } from '@/hooks/useWalletTopUpAvailability';
import { getWalletTopUpAvailability } from '@/lib/api';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The entry row fails closed on a failed refetch; a checkout already on screen
 * keeps the SDK config it was loaded with.
 */

jest.mock('@/lib/api', () => ({ getWalletTopUpAvailability: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'user-1' } }),
}));

const mockGet = getWalletTopUpAvailability as jest.MockedFunction<
  typeof getWalletTopUpAvailability
>;

const SDK = { webEnvironment: 'uat', mobileEnvironment: 'test', clientId: null } as const;

const AVAILABLE: WalletTopUpAvailability = {
  available: true,
  reason: 'ok',
  capabilityStatus: 'Active',
  sdk: SDK,
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  currencies: ['USD'],
  defaultCurrency: 'USD',
  limits: { USD: { min: '10.00', max: '500.00' } },
  payoutTokens: { USD: 'USDC' },
};

type Result = ReturnType<typeof useWalletTopUpAvailability>;

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

/** Mount the hook, let `then` refetch, and return every answer it gave. */
const mount = async (then: (client: QueryClient) => Promise<void>) => {
  // The hook retries once; no need to wait out the backoff here.
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const answers: Result[] = [];
  const Probe = () => {
    answers.push(useWalletTopUpAvailability());
    return null;
  };
  let root: any;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  await then(client);
  await act(async () => root.unmount());
  client.clear();
  return answers;
};

const refetch = async (client: QueryClient) => {
  await act(async () => {
    await client.refetchQueries().catch(() => undefined);
  });
  await settle();
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

it('keeps the checkout SDK through a failed refetch, while the row fails closed', async () => {
  mockGet.mockResolvedValueOnce(AVAILABLE);

  const answers = await mount(async client => {
    mockGet.mockRejectedValue(new Error('offline'));
    await refetch(client);
  });

  expect(answers.some(answer => answer.isAvailable)).toBe(true);
  const last = answers[answers.length - 1];
  expect(last.isAvailable).toBe(false);
  expect(last.availability).toBeUndefined();
  expect(last.checkoutSdk).toEqual(SDK);
});

it('drops the checkout SDK once the backend no longer offers the top-up', async () => {
  mockGet.mockResolvedValueOnce(AVAILABLE);

  const answers = await mount(async client => {
    mockGet.mockResolvedValue({ ...AVAILABLE, available: false, reason: 'disabled', sdk: null });
    await refetch(client);
  });

  const last = answers[answers.length - 1];
  expect(last.isAvailable).toBe(false);
  expect(last.checkoutSdk).toBeUndefined();
});
