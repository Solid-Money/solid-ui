import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base } from 'viem/chains';

import RhinoNetworkGroup from '@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup';
import { getRhinoDepositAssets } from '@/lib/api';

import type { RhinoDepositAssetsResponse, RhinoDestinationType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getRhinoDepositAssets: jest.fn() }));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: mockAccess.isEnabled, isLoading: false }),
}));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/DepositOption/WalletDepositAddress/constants', () => ({
  getWalletDepositTokenIcon: (symbol: string) => symbol,
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockAccess = { isEnabled: true };
const mockGetAssets = getRhinoDepositAssets as jest.MockedFunction<typeof getRhinoDepositAssets>;

const route = (destinationType: RhinoDestinationType, receiveSymbol: string, vault?: string) => ({
  destinationType,
  receiveSymbol,
  receiveChainId: base.id,
  minimumUsd: 5,
  maximumUsd: 100000,
  ...(vault ? { vault: vault as 'soUSD' } : {}),
});

const ASSETS: RhinoDepositAssetsResponse = {
  enabled: true,
  chains: [
    {
      chain: 'TRON',
      name: 'Tron',
      addressType: 'TRON',
      tokens: [
        {
          symbol: 'USDT',
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          routes: [route('RAIN_CARD', 'USDC'), route('PROTOCOL', 'USDC', 'soUSD')],
        },
      ],
    },
    {
      chain: 'OPTIMISM',
      name: 'Optimism',
      addressType: 'EVM',
      tokens: [
        {
          symbol: 'USDC',
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          routes: [route('RAIN_CARD', 'USDC'), route('PROTOCOL', 'USDC', 'soUSD')],
        },
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          routes: [route('RAIN_CARD', 'USDC'), route('PROTOCOL', 'ETH', 'soETH')],
        },
      ],
    },
    {
      chain: 'SOLANA',
      name: 'Solana',
      addressType: 'SOL',
      tokens: [
        {
          symbol: 'USDC',
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          routes: [route('WALLET', 'USDC')],
        },
      ],
    },
  ],
};

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

let client: QueryClient;
let root: any;

const mount = async (props: Partial<React.ComponentProps<typeof RhinoNetworkGroup>> = {}) => {
  const onSelect = jest.fn();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <RhinoNetworkGroup destinationType="RAIN_CARD" onSelect={onSelect} {...props} />
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
  mockAccess.isEnabled = true;
  mockGetAssets.mockResolvedValue(ASSETS);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

describe('RhinoNetworkGroup', () => {
  it('lists the chains that pay out to the card, and only those', async () => {
    await mount({ destinationType: 'RAIN_CARD' });
    expect(titles()).toEqual(['Tron', 'Optimism']);
  });

  it('narrows to the chosen token and the vault being funded', async () => {
    await mount({ destinationType: 'PROTOCOL', symbol: 'USDT', vault: 'soUSD' });
    expect(titles()).toEqual(['Tron']);

    await act(async () => root.unmount());
    await mount({ destinationType: 'PROTOCOL', symbol: 'ETH', vault: 'soUSD' });
    expect(rows()).toHaveLength(0);
  });

  it('shows nothing outside the rollout, without asking for the list', async () => {
    mockAccess.isEnabled = false;
    await mount();
    expect(rows()).toHaveLength(0);
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  it('shows nothing when rhino.fi is not configured on the backend', async () => {
    mockGetAssets.mockResolvedValue({ ...ASSETS, enabled: false });
    await mount();
    expect(rows()).toHaveLength(0);
  });

  it('selects a chain with one qualifying token straight away', async () => {
    const onSelect = await mount({ destinationType: 'RAIN_CARD', symbol: 'USDT' });
    press('Tron');
    expect(onSelect).toHaveBeenCalledWith({
      chain: 'TRON',
      tokenSymbol: 'USDT',
      destinationType: 'RAIN_CARD',
      vault: undefined,
    });
  });

  it('asks which token when the chain takes more than one', async () => {
    const onSelect = await mount({ destinationType: 'RAIN_CARD' });
    press('Optimism');
    expect(onSelect).not.toHaveBeenCalled();
    expect(titles()).toEqual(['Tron', 'Optimism', 'Send USDC', 'Send ETH']);

    press('Send ETH');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ chain: 'OPTIMISM', tokenSymbol: 'ETH' }),
    );
  });
});
