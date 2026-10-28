import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useWalletEligibility } from '@/hooks/useWalletEligibility';
import { getWalletEligibility } from '@/lib/api';
import { CardProvider, WalletEligibilityResponse } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
let mockUserId: string | undefined;
let mockProvider: CardProvider | null;

jest.mock('@/lib/api', () => ({ getWalletEligibility: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: (state: unknown) => unknown) =>
    selector({ users: mockUserId ? [{ userId: mockUserId, selected: true }] : [] }),
}));

const mockGetWalletEligibility = jest.mocked(getWalletEligibility);
let client: QueryClient;
let root: any;
let result: ReturnType<typeof useWalletEligibility>;

function Probe({ enabled = true }: { enabled?: boolean }) {
  const value = useWalletEligibility(enabled);
  React.useEffect(() => {
    result = value;
  }, [value]);
  return null;
}

const render = async (enabled = true) => {
  await act(async () => {
    const element = (
      <QueryClientProvider client={client}>
        <Probe enabled={enabled} />
      </QueryClientProvider>
    );
    if (root) root.update(element);
    else root = create(element);
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'rain-account';
  mockProvider = CardProvider.RAIN;
  mockGetWalletEligibility.mockResolvedValue({ eligible: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = undefined;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client.clear();
});

it('checks a real Rain card when the wallet prompt is enabled', async () => {
  await render();
  expect(mockGetWalletEligibility).toHaveBeenCalledTimes(1);
  expect(result.data).toEqual({ eligible: true });
});

it.each([CardProvider.WIREX, CardProvider.BRIDGE, null])(
  'does not call the Rain-only route for provider %s',
  async provider => {
    mockProvider = provider;
    await render();
    expect(mockGetWalletEligibility).not.toHaveBeenCalled();
  },
);

it('does not request eligibility for a preview card that has no backend resource', async () => {
  mockUserId = 'dummy';
  await render();
  expect(mockGetWalletEligibility).not.toHaveBeenCalled();
});

it('does not request eligibility without an account or an enabled prompt', async () => {
  await render(false);
  mockUserId = undefined;
  await render();
  expect(mockGetWalletEligibility).not.toHaveBeenCalled();
});

it('keeps eligibility separate when switching accounts', async () => {
  const first: WalletEligibilityResponse = { eligible: true, alreadyInGoogleWallet: true };
  mockGetWalletEligibility.mockResolvedValueOnce(first).mockResolvedValueOnce({ eligible: false });
  await render();
  expect(result.data).toEqual(first);
  mockUserId = 'second-rain-account';
  await render();
  expect(mockGetWalletEligibility).toHaveBeenCalledTimes(2);
  expect(result.data).toEqual({ eligible: false });
});

it('drops the Rain eligibility result when the issuer changes to Wirex', async () => {
  await render();
  mockProvider = CardProvider.WIREX;
  await render();
  expect(mockGetWalletEligibility).toHaveBeenCalledTimes(1);
  expect(result.data).toBeUndefined();
});

it('treats a card that no longer exists as a settled empty result', async () => {
  mockGetWalletEligibility.mockResolvedValue(null);
  await render();
  expect(result.data).toBeNull();
  expect(result.isError).toBe(false);
});
