import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useRhinoExtraNetworkRows } from '@/components/DepositOption/RhinoDeposit/useRhinoExtraNetworkRows';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { getRhinoDepositAssets } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getRhinoDepositAssets: jest.fn() }));
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoChainIcon', () => 'RhinoChainIcon');
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockGetAssets = getRhinoDepositAssets as jest.MockedFunction<typeof getRhinoDepositAssets>;

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

let client: QueryClient;
let root: any;

type Options = Parameters<typeof useRhinoExtraNetworkRows>[0];

/** The rows, as a funding flow puts them in its own list. */
const Host = (options: Options) => <>{useRhinoExtraNetworkRows(options)}</>;

const mount = async (props: Partial<Options> = {}) => {
  const onSelect = jest.fn();
  client?.clear();
  // No garbage-collection timer, which would hold jest open for five minutes.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Host destinationType="RAIN_CARD" symbol="USDC" onSelect={onSelect} {...props} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return onSelect;
};

const rows = () => root.root.findAllByType('CardFundRow');
const titles = () => rows().map((row: any) => row.props.title);
const press = (title: string) => {
  const row = rows().find((node: any) => node.props.title === title);
  act(() => row.props.onPress());
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockGetAssets.mockResolvedValue(RHINO_ASSETS);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

/**
 * rhino.fi's chains the app has no row for, for the token and destination the
 * screen has already chosen, as rows for the screen's own network list.
 */
describe('useRhinoExtraNetworkRows', () => {
  // Never Ethereum, Base, Optimism or Fuse, which are rows of the app's own;
  // never Arc, held back.
  it('lists only the chains the app has no row for, for the token chosen', async () => {
    await mount({ destinationType: 'RAIN_CARD', symbol: 'USDC' });
    expect(titles()).toEqual(['Solana', 'Avalanche']);
  });

  // On savings, USDT into soUSD stays rhino.fi's, Tron and all.
  it('narrows to the vault being funded', async () => {
    await mount({ destinationType: 'PROTOCOL', symbol: 'USDT', vault: 'soUSD' });
    expect(titles()).toEqual(['Tron', 'Solana', 'Avalanche']);

    await act(async () => root.unmount());
    await mount({ destinationType: 'PROTOCOL', symbol: 'EURC', vault: 'soEURC' });
    expect(titles()).toEqual(['Solana']);

    await act(async () => root.unmount());
    await mount({ destinationType: 'PROTOCOL', symbol: 'ETH', vault: 'soUSD' });
    expect(rows()).toHaveLength(0);
  });

  // rhino.fi pays USDT to the card or the wallet out as USDC, Tron and all.
  it('lists the chains rhino.fi takes USDT to the card or the wallet from', async () => {
    await mount({ destinationType: 'RAIN_CARD', symbol: 'USDT' });
    expect(titles()).toEqual(['Tron', 'Solana', 'Avalanche']);

    await act(async () => root.unmount());
    await mount({ destinationType: 'WALLET', symbol: 'USDT' });
    expect(titles()).toEqual(['Tron', 'Solana', 'Avalanche']);
  });

  it('shows nothing when rhino.fi is off, or its routes cannot be had', async () => {
    mockGetAssets.mockResolvedValue({ ...RHINO_ASSETS, enabled: false });
    await mount();
    expect(rows()).toHaveLength(0);

    mockGetAssets.mockRejectedValue(new Error('down'));
    await act(async () => root.unmount());
    await mount();
    expect(rows()).toHaveLength(0);
  });

  it('selects the chain’s rhino.fi address, with no app chain for Solana', async () => {
    const onSelect = await mount({ destinationType: 'PROTOCOL', symbol: 'USDC', vault: 'soUSD' });
    press('Solana');
    expect(onSelect).toHaveBeenCalledWith({
      chain: 'SOLANA',
      tokenSymbol: 'USDC',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
    });

    press('Avalanche');
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'AVALANCHE', chainId: 43114 }),
    );
  });
});
