import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { checkWalletAvailability } from '@wirexapp/card-wallet-topup-web';

import { useWalletDeviceAvailability } from '@/hooks/useWalletDeviceAvailability.web';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * Web: the device probe answers for the provider's block, so a new block asks
 * again instead of reusing the answer cached for the old one.
 */

// Virtual: the package exports an ESM `import` condition only, which jest's resolver skips.
jest.mock('@wirexapp/card-wallet-topup-web', () => ({ checkWalletAvailability: jest.fn() }), {
  virtual: true,
});

const mockCheck = checkWalletAvailability as jest.MockedFunction<typeof checkWalletAvailability>;

const availability = (
  walletConfig: Record<string, unknown>,
  clientId = 'client-1',
): WalletTopUpAvailability => ({
  available: true,
  reason: 'ok',
  capabilityStatus: 'Active',
  sdk: { webEnvironment: 'uat', mobileEnvironment: 'test', clientId },
  provider: 'checkout',
  walletConfig,
  currencies: ['USD'],
  defaultCurrency: 'USD',
  limits: { USD: { min: '10.00', max: '500.00' } },
  payoutTokens: { USD: 'USDC' },
});

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

let client: QueryClient;
let root: any;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  globalThis.localStorage?.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// Here rather than in the test, so a failed expectation cannot leave timers running.
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  client.clear();
});

it('probes again, with the new block, when the provider’s config changes', async () => {
  mockCheck
    .mockResolvedValueOnce({ applePay: false, googlePay: true } as any)
    .mockResolvedValueOnce({ applePay: false, googlePay: false } as any);

  const devices: unknown[] = [];
  const Probe = ({ value }: { value: WalletTopUpAvailability }) => {
    devices.push(useWalletDeviceAvailability(value).device);
    return null;
  };
  const tree = (value: WalletTopUpAvailability) => (
    <QueryClientProvider client={client}>
      <Probe value={value} />
    </QueryClientProvider>
  );

  const first = { google_pay: { merchantId: 'm-1' } };
  const second = { google_pay: { merchantId: 'm-2' } };
  await act(async () => {
    root = create(tree(availability(first)));
  });
  await settle();
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: true });

  // The same block again, as a fresh object: still the cached answer.
  await act(async () => root.update(tree(availability({ ...first }))));
  await settle();
  expect(mockCheck).toHaveBeenCalledTimes(1);

  await act(async () => root.update(tree(availability(second))));
  await settle();
  expect(mockCheck).toHaveBeenCalledTimes(2);
  // The first ask uses the SDK's cache; the changed block forces past it.
  expect(mockCheck.mock.calls[0][1]).toMatchObject({ config: first, force: false });
  expect(mockCheck.mock.calls[1][1]).toMatchObject({ config: second, force: true });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: false });
});

it('skips the SDK cache after a reload when the block changed meanwhile', async () => {
  // Like the SDK: an answer cached per frame, whatever block it is asked with,
  // unless forced.
  let cached: { applePay: boolean; googlePay: boolean } | undefined;
  mockCheck.mockImplementation(async (_init, options) => {
    if (!options?.force && cached) return cached as any;
    const fresh = {
      applePay: false,
      googlePay: (options?.config as any)?.google_pay?.merchantId === 'm-1',
    };
    cached = fresh;
    return fresh as any;
  });

  const devices: unknown[] = [];
  const Probe = ({ value }: { value: WalletTopUpAvailability }) => {
    devices.push(useWalletDeviceAvailability(value).device);
    return null;
  };
  const mount = async (config: Record<string, unknown>) => {
    await act(async () => {
      root = create(
        <QueryClientProvider client={client}>
          <Probe value={availability(config, 'client-2')} />
        </QueryClientProvider>,
      );
    });
    await settle();
  };

  await mount({ google_pay: { merchantId: 'm-1' } });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: true });

  // "Reload": a fresh query cache, while the SDK's cache and storage survive.
  await act(async () => root.unmount());
  client.clear();
  await mount({ google_pay: { merchantId: 'm-2' } });

  expect(mockCheck.mock.calls[mockCheck.mock.calls.length - 1][1]).toMatchObject({
    force: true,
  });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: false });
});
