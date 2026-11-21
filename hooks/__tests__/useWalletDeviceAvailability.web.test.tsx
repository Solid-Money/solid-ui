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

/** localStorage as the browser keeps it: outlives the query cache, so a "reload" keeps it. */
const storage = new Map<string, string>();
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
});

afterAll(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else delete (globalThis as any).localStorage;
});

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  storage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

/** Like the SDK: an answer cached per frame, whatever block it is asked with, unless forced. */
const sdkWithCache = (initial?: { applePay: boolean; googlePay: boolean }) => {
  let cached = initial;
  mockCheck.mockImplementation(async (_init, options) => {
    if (!options?.force && cached) return cached as any;
    const fresh = {
      applePay: false,
      googlePay: (options?.config as any)?.google_pay?.merchantId === 'm-1',
    };
    cached = fresh;
    return fresh as any;
  });
};

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
  // No record of an earlier block: the first ask forces too; so does the change.
  expect(mockCheck.mock.calls[0][1]).toMatchObject({ config: first, force: true });
  expect(mockCheck.mock.calls[1][1]).toMatchObject({ config: second, force: true });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: false });
});

const mountWith = async (config: Record<string, unknown>) => {
  const devices: unknown[] = [];
  const Probe = ({ value }: { value: WalletTopUpAvailability }) => {
    devices.push(useWalletDeviceAvailability(value).device);
    return null;
  };
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe value={availability(config)} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return devices;
};

/** A reload: a fresh query cache and React tree, while the SDK's cache and storage survive. */
const reload = async () => {
  await act(async () => root.unmount());
  root = undefined;
  client.clear();
};

it('never trusts an SDK answer cached before the block was remembered', async () => {
  // A browser that probed with an older build: the SDK holds an answer, we hold no block.
  sdkWithCache({ applePay: false, googlePay: false });

  const devices = await mountWith({ google_pay: { merchantId: 'm-1' } });

  expect(mockCheck.mock.calls[0][1]).toMatchObject({ force: true });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: true });
});

it('uses the SDK cache after a reload only for the block it answered for', async () => {
  sdkWithCache();
  await mountWith({ google_pay: { merchantId: 'm-1' } });

  // Same block after a reload: the remembered block matches, the SDK cache is fine.
  await reload();
  let devices = await mountWith({ google_pay: { merchantId: 'm-1' } });
  expect(mockCheck.mock.calls[mockCheck.mock.calls.length - 1][1]).toMatchObject({ force: false });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: true });

  // A new block after a reload: read back from storage, it forces past the SDK cache.
  await reload();
  devices = await mountWith({ google_pay: { merchantId: 'm-2' } });
  expect(mockCheck.mock.calls[mockCheck.mock.calls.length - 1][1]).toMatchObject({ force: true });
  expect(devices[devices.length - 1]).toMatchObject({ googlePay: false });
});
