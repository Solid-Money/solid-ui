import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import { RHINO_ASSETS, RHINO_ASSETS_WITH_BITCOIN } from '@/lib/__tests__/rhinoFixtures';
import { getRhinoDepositAssets } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getRhinoDepositAssets: jest.fn() }));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
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

const mount = async (props: Partial<React.ComponentProps<typeof RhinoNetworkGroup>> = {}) => {
  const onSelect = jest.fn();
  client?.clear();
  // No garbage-collection timer, which would hold jest open for five minutes.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <RhinoNetworkGroup
          destinationType="RAIN_CARD"
          symbol="USDC"
          onSelect={onSelect}
          {...props}
        />
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
 * "More networks": rhino.fi's chains the app has no row for, for the token and
 * destination the screen has already chosen. Of those, only Bitcoin is
 * offered (product decision, 2026-11-10).
 */
describe('RhinoNetworkGroup', () => {
  // Tron, Solana, Avalanche and Arc are listed by the backend, with routes for
  // these tokens, and are no longer offered: the group is not there at all.
  it('shows no group for a token only those chains would add', async () => {
    mockGetAssets.mockResolvedValue(RHINO_ASSETS_WITH_BITCOIN);
    for (const props of [
      { destinationType: 'RAIN_CARD' as const, symbol: 'USDC' },
      { destinationType: 'RAIN_CARD' as const, symbol: 'USDT' },
      { destinationType: 'WALLET' as const, symbol: 'USDT' },
      { destinationType: 'PROTOCOL' as const, symbol: 'USDT', vault: 'soUSD' },
      { destinationType: 'PROTOCOL' as const, symbol: 'EURC', vault: 'soEURC' },
    ]) {
      await act(async () => root?.unmount());
      await mount(props);
      expect(root.root.findAllByType('CardFundGroup')).toHaveLength(0);
    }
  });

  it('lists Bitcoin for native BTC, where the backend has it on', async () => {
    mockGetAssets.mockResolvedValue(RHINO_ASSETS_WITH_BITCOIN);
    const onSelect = await mount({ destinationType: 'RAIN_CARD', symbol: 'BTC' });
    expect(titles()).toEqual(['Bitcoin']);
    expect(root.root.findByType('CardFundGroup').props.label).toBe('More networks');

    press('Bitcoin');
    expect(onSelect).toHaveBeenCalledWith({
      chain: 'BITCOIN',
      tokenSymbol: 'BTC',
      destinationType: 'RAIN_CARD',
    });

    await act(async () => root.unmount());
    mockGetAssets.mockResolvedValue(RHINO_ASSETS);
    await mount({ destinationType: 'RAIN_CARD', symbol: 'BTC' });
    expect(rows()).toHaveLength(0);
  });

  it('shows nothing when rhino.fi is off, or its routes cannot be had', async () => {
    mockGetAssets.mockResolvedValue({ ...RHINO_ASSETS_WITH_BITCOIN, enabled: false });
    await mount({ symbol: 'BTC' });
    expect(rows()).toHaveLength(0);

    mockGetAssets.mockRejectedValue(new Error('down'));
    await act(async () => root.unmount());
    await mount({ symbol: 'BTC' });
    expect(rows()).toHaveLength(0);
  });
});
