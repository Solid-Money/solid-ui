import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { checkWalletAvailability } from '@wirexapp/card-wallet-topup-web';

import { useWalletDeviceAvailability } from '@/hooks/useWalletDeviceAvailability.web';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * Web: the device probe answers for the provider's block and never trusts the
 * SDK's own caches; what stands in until it answers is only ever an answer
 * remembered for the very same environment, client and block.
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

const M1 = { google_pay: { merchantId: 'm-1' } };
const M2 = { google_pay: { merchantId: 'm-2' } };
/** What this device can do for a block, as a fresh probe finds it. */
const answerFor = (config: unknown) => ({
  applePay: false,
  googlePay: (config as typeof M1 | undefined)?.google_pay?.merchantId === 'm-1',
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
  // By default the frame answers at once, for the block it is asked with.
  mockCheck.mockImplementation(async (_init, options) => answerFor(options?.config) as any);
});

/**
 * Like the SDK: an answer cached per frame origin, whatever client or block it
 * is asked with (every test here is one environment), unless forced.
 */
const sdkWithCache = (initial: { applePay: boolean; googlePay: boolean }) => {
  let cached = initial;
  mockCheck.mockImplementation(async (_init, options) => {
    if (!options?.force) return cached as any;
    cached = answerFor(options.config);
    return cached as any;
  });
};

/** Each probe waits until the test answers it, as a slow frame would. */
const deferredSdk = () => {
  const pending: { config: unknown; answer: (value: unknown) => Promise<void> }[] = [];
  mockCheck.mockImplementation(
    (_init, options) =>
      new Promise(resolve => {
        pending.push({
          config: options?.config,
          answer: value =>
            act(async () => {
              resolve(value as any);
            }),
        });
      }) as any,
  );
  return pending;
};

// Here rather than in the test, so a failed expectation cannot leave timers running.
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  client.clear();
});

/** One tab: its own query cache and React tree, sharing the browser's storage. */
const mountTab = async (config: Record<string, unknown>, clientId?: string) => {
  const devices: unknown[] = [];
  const tabClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Probe = ({ value }: { value: WalletTopUpAvailability }) => {
    devices.push(useWalletDeviceAvailability(value).device);
    return null;
  };
  let tabRoot: any;
  await act(async () => {
    tabRoot = create(
      <QueryClientProvider client={tabClient}>
        <Probe value={availability(config, clientId)} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return {
    devices,
    close: async () => {
      await act(async () => tabRoot.unmount());
      tabClient.clear();
    },
  };
};

const mountWith = async (config: Record<string, unknown>, clientId?: string) => {
  const devices: unknown[] = [];
  const Probe = ({ value }: { value: WalletTopUpAvailability }) => {
    devices.push(useWalletDeviceAvailability(value).device);
    return null;
  };
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe value={availability(config, clientId)} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return devices;
};

/** A reload: a fresh query cache and React tree, while storage (and the SDK's cache) survive. */
const reload = async () => {
  await act(async () => root.unmount());
  root = undefined;
  client.clear();
};

const last = (devices: unknown[]) => devices[devices.length - 1];

it('probes again, with the new block, when the provider’s config changes', async () => {
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

  await act(async () => {
    root = create(tree(availability(M1)));
  });
  await settle();
  expect(last(devices)).toMatchObject({ googlePay: true });

  // The same block again, as a fresh object: still the answer this session got.
  await act(async () => root.update(tree(availability({ ...M1 }))));
  await settle();
  expect(mockCheck).toHaveBeenCalledTimes(1);

  await act(async () => root.update(tree(availability(M2))));
  await settle();
  expect(mockCheck).toHaveBeenCalledTimes(2);
  expect(mockCheck.mock.calls[0][1]).toMatchObject({ config: M1, force: true });
  expect(mockCheck.mock.calls[1][1]).toMatchObject({ config: M2, force: true });
  expect(last(devices)).toMatchObject({ googlePay: false });
});

it('never trusts the SDK’s own cache, whatever it holds', async () => {
  // A browser whose SDK cache holds an answer for some other client or block.
  sdkWithCache({ applePay: false, googlePay: false });

  const devices = await mountWith(M1);

  expect(mockCheck.mock.calls[0][1]).toMatchObject({ force: true });
  expect(last(devices)).toMatchObject({ googlePay: true });
});

it('shows the answer remembered for this exact identity while the fresh probe runs, then the fresh one', async () => {
  await mountWith(M1);
  await reload();

  const pending = deferredSdk();
  const devices = await mountWith(M1);
  // The frame has not answered: the answer this browser got last time stands in.
  expect(pending).toHaveLength(1);
  expect(last(devices)).toMatchObject({ googlePay: true });

  // The device changed since: the fresh answer replaces it.
  await pending[0].answer({ applePay: false, googlePay: false });
  await settle();
  expect(last(devices)).toMatchObject({ googlePay: false });
});

it('never stands in an answer remembered for another client or block', async () => {
  await mountWith(M1, 'client-a');

  for (const [config, clientId] of [
    [M1, 'client-b'],
    [M2, 'client-a'],
  ] as const) {
    await reload();
    const pending = deferredSdk();
    const devices = await mountWith(config, clientId);
    expect(devices.every(device => device === null)).toBe(true);
    await pending[0].answer(answerFor(config));
    await settle();
    expect(last(devices)).toMatchObject(answerFor(config));
  }
});

it('never shows one identity the answer another tab probed for another, however late it lands', async () => {
  const pending = deferredSdk();
  // Tab A starts probing client A; tab B probes client B and is answered first…
  const tabA = await mountTab(M1, 'client-a');
  const tabB = await mountTab(M2, 'client-b');
  await pending[1].answer(answerFor(M2));
  // …then A's probe lands late, after B's was remembered.
  await pending[0].answer(answerFor(M1));
  await settle();
  expect(last(tabA.devices)).toMatchObject({ googlePay: true });
  expect(last(tabB.devices)).toMatchObject({ googlePay: false });
  await tabA.close();
  await tabB.close();

  // B reloads: what is remembered now is A's answer, so nothing stands in, and
  // B never sees A's answer — only its own fresh one.
  const devices = await mountWith(M2, 'client-b');
  expect(devices.every(device => device === null)).toBe(true);
  expect(pending).toHaveLength(3);
  await pending[2].answer(answerFor(M2));
  await settle();
  expect(devices.some(device => (device as { googlePay?: boolean } | null)?.googlePay)).toBe(false);
  expect(last(devices)).toMatchObject({ googlePay: false });
  expect(mockCheck.mock.calls.every(([, options]) => options?.force === true)).toBe(true);
});

it('ignores a remembered answer it cannot read', async () => {
  storage.set('walletTopUpDevice.answer', 'not json');
  const pending = deferredSdk();

  const devices = await mountWith(M1);

  expect(devices.every(device => device === null)).toBe(true);
  await pending[0].answer(answerFor(M1));
  await settle();
  expect(last(devices)).toMatchObject({ googlePay: true });
});

it('is immune to the SDK’s background revalidation refilling its slot for another identity', async () => {
  // Like the SDK: unforced, it serves its one slot at once and revalidates in
  // the background, writing the slot whenever that lands.
  let slot: { applePay: boolean; googlePay: boolean } | undefined;
  const revalidations: (() => void)[] = [];
  mockCheck.mockImplementation(async (_init, options) => {
    const fresh = answerFor(options?.config);
    if (!options?.force && slot) {
      const served = slot;
      revalidations.push(() => {
        slot = fresh;
      });
      return served as any;
    }
    slot = fresh;
    return fresh as any;
  });

  // Client A loads twice, client B twice, then whatever A's loads left
  // revalidating lands — refilling the slot with A's answer.
  for (const [config, clientId] of [
    [M1, 'client-a'],
    [M1, 'client-a'],
    [M2, 'client-b'],
    [M2, 'client-b'],
  ] as const) {
    await mountWith(config, clientId);
    await reload();
  }
  revalidations.forEach(land => land());

  // B again: its own answer, never the one A's revalidation left in the slot.
  const devices = await mountWith(M2, 'client-b');
  expect(devices.some(device => (device as { googlePay?: boolean } | null)?.googlePay)).toBe(false);
  expect(last(devices)).toMatchObject({ googlePay: false });
  // The SDK never served from its cache, so never started a revalidation.
  expect(revalidations).toHaveLength(0);
});
