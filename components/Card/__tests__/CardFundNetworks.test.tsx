import React from 'react';
import { arbitrum, base, fuse, polygon } from 'viem/chains';

import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import { RHINO_ASSETS, RHINO_ASSETS_WITH_BITCOIN } from '@/lib/__tests__/rhinoFixtures';
import { RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';
import { CardProvider } from '@/lib/types';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Fund your card", step 2: rhino.fi is the provider on every row but Fuse's,
 * so the list offers those rows only once rhino.fi has a route from them, and
 * never an address of ours in their place.
 */

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// "More networks" is tested on its own; here, only what it is asked for.
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoNetworkGroup', () => 'RhinoNetworkGroup');
// Its barrel reaches wagmi's ESM build, which does not load under jest-expo.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
// The real module pulls `lib/assets`, which does not load under jest-expo.
jest.mock('@/components/Card/CardFund/constants', () => ({
  ...jest.requireActual('@/lib/utils/cardFunding'),
  CARD_FUND_ESTIMATED_TIME: '~3 min',
  getCardFundNetworks: (symbol: string) => mockNetworks(symbol),
}));
// The rows as `useRhinoNetworkRows` resolves them (tested on its own), over
// whichever state of rhino.fi's routes the case sets.
jest.mock('@/hooks/useRhinoDepositAssets', () => {
  const { getRhinoExtraChains, resolveRhinoRow } = jest.requireActual('@/lib/rhinoDeposit');
  return {
    useOfferedRhinoDepositAssets: () => mockRhino.current,
    useRhinoExtraNetworks: (filter: object) =>
      mockRhino.current.status === 'ready'
        ? getRhinoExtraChains(mockRhino.current.assets, filter)
        : [],
    useRhinoNetworkRows: (filter: object, rows: { chainId: number }[]) => ({
      rows: rows.map(row => ({
        row,
        state: resolveRhinoRow(mockRhino.current, { ...filter, chainId: row.chainId }),
      })),
      retry: mockRhino.current.retry,
    }),
  };
});

// As `getCardFundChains` lists them: Base carries no USDT in `BRIDGE_TOKENS`,
// and no chain of the list's own carries BTC.
const mockNetworks = (symbol: string) =>
  symbol === 'BTC'
    ? []
    : symbol === 'EURC'
      ? [{ chainId: base.id, name: 'Base', icon: 'base' }]
      : [
          { chainId: polygon.id, name: 'Polygon', icon: 'polygon' },
          ...(symbol === 'USDT' ? [] : [{ chainId: base.id, name: 'Base', icon: 'base' }]),
          { chainId: arbitrum.id, name: 'Arbitrum', icon: 'arbitrum' },
          { chainId: fuse.id, name: 'Fuse', icon: 'fuse' },
        ];
const mockRetry = jest.fn();
const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: mockRetry,
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };

let root: any;
const render = (symbol = 'USDC', cardProvider = CardProvider.RAIN) => {
  const onSelect = jest.fn();
  act(() => {
    root = create(
      <CardFundNetworks
        symbol={symbol}
        cardProvider={cardProvider}
        onSelect={onSelect}
        onSelectRhino={jest.fn()}
      />,
    );
  });
  return onSelect;
};

const rows = () => root.root.findAllByType('CardFundRow');
const titles = () => rows().map((row: any) => row.props.title);
const texts = (): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => node.props.children)
    .filter((child: unknown) => typeof child === 'string');

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockRhino.current = READY;
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('CardFundNetworks', () => {
  it('marks every row rhino.fi serves, Base included, and keeps Fuse our own', () => {
    render();

    expect(titles()).toEqual(['Polygon', 'Base', 'Arbitrum', 'Fuse']);
    const chips = Object.fromEntries(rows().map((row: any) => [row.props.title, row.props.chips]));
    expect(chips.Polygon).toContain(RHINO_NETWORK_CHIP);
    expect(chips.Base).toContain(RHINO_NETWORK_CHIP);
    expect(chips.Fuse).not.toContain(RHINO_NETWORK_CHIP);
  });

  it('leaves out a row rhino.fi has no card route from', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'ARBITRUM'),
      },
    };
    render();

    expect(titles()).toEqual(['Polygon', 'Base', 'Fuse']);
  });

  it('offers only Fuse, with a loader for the rest, until rhino.fi’s routes are in', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    render();

    expect(titles()).toEqual(['Fuse']);
    expect(
      root.root.findAll((node: any) => node.props.accessibilityLabel === 'Loading networks').length,
    ).toBeGreaterThan(0);
  });

  it('offers only Fuse, with a retry for the rest, when the routes cannot be had', () => {
    mockRhino.current = { status: 'unavailable', retry: mockRetry };
    render();

    expect(titles()).toEqual(['Fuse']);
    expect(texts()).toContain('Couldn’t load the other networks.');
    act(() => root.root.findByType('Button').props.onPress());
    expect(mockRetry).toHaveBeenCalled();
  });

  // No card route takes EURC; the card address delivered it to the Safe on Base,
  // which is what rhino.fi's wallet route pays.
  it('takes EURC through rhino.fi’s wallet route', () => {
    render('EURC');
    expect(titles()).toEqual(['Base']);
    expect(rows()[0].props.chips).toContain(RHINO_NETWORK_CHIP);
  });

  // BTC has no row of the list's own: Bitcoin, under "More networks", alone.
  it('offers BTC from "More networks" alone, with no empty state over it', () => {
    mockRhino.current = { ...READY, assets: RHINO_ASSETS_WITH_BITCOIN };
    render('BTC');

    expect(rows()).toHaveLength(0);
    expect(texts()).not.toContain('No network takes BTC right now.');
    expect(root.root.findByType('RhinoNetworkGroup').props).toMatchObject({
      destinationType: 'RAIN_CARD',
      symbol: 'BTC',
    });
  });

  it('waits for rhino.fi’s routes for BTC, and offers a retry if they cannot be had', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    render('BTC');
    expect(
      root.root.findAll((node: any) => node.props.accessibilityLabel === 'Loading networks').length,
    ).toBeGreaterThan(0);
    expect(texts()).not.toContain('No network takes BTC right now.');
    act(() => root.unmount());

    mockRhino.current = { status: 'unavailable', retry: mockRetry };
    render('BTC');
    expect(texts()).toContain('Couldn’t load the networks.');
  });

  it('says no network takes BTC once rhino.fi has Bitcoin off', () => {
    render('BTC');
    expect(texts()).toContain('No network takes BTC right now.');
  });

  // Not Base, nor Solana under "More networks": nowhere at all.
  it('says so when no row takes the token', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(
          chain => chain.chain !== 'BASE' && chain.chain !== 'SOLANA',
        ),
      },
    };
    render('EURC');

    expect(rows()).toHaveLength(0);
    expect(texts()).toContain('No network takes EURC right now.');
  });

  // "No network takes EURC" over a list that has Solana would contradict it.
  it('says nothing is empty when "More networks" takes the token', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BASE'),
      },
    };
    render('EURC');

    expect(rows()).toHaveLength(0);
    expect(texts()).not.toContain('No network takes EURC right now.');
  });

  // rhino.fi takes USDT from every row but Fuse's, and pays it out as USDC: to
  // the card for Rain, to the Safe on Base for Wirex.
  it('serves every USDT row but Fuse’s through rhino.fi', () => {
    [CardProvider.RAIN, CardProvider.WIREX].forEach(provider => {
      render('USDT', provider);

      expect(titles()).toEqual(['Polygon', 'Arbitrum', 'Fuse']);
      const chips = Object.fromEntries(
        rows().map((row: any) => [row.props.title, row.props.chips]),
      );
      expect(chips.Polygon).toContain(RHINO_NETWORK_CHIP);
      expect(chips.Arbitrum).toContain(RHINO_NETWORK_CHIP);
      expect(chips.Fuse).not.toContain(RHINO_NETWORK_CHIP);
      act(() => root.unmount());
      root = undefined;
    });
  });

  it('offers only Fuse’s USDT row until rhino.fi’s routes are in', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    render('USDT');

    expect(titles()).toEqual(['Fuse']);
  });

  // A Wirex cardholder's USDC lands in their Safe on Base: the wallet route.
  it('matches a Wirex cardholder’s USDC against the wallet route, and Rain’s the card’s', () => {
    render('USDC', CardProvider.WIREX);
    expect(titles()).toEqual(['Polygon', 'Base', 'Arbitrum', 'Fuse']);
    expect(root.root.findByType('RhinoNetworkGroup').props).toMatchObject({
      destinationType: 'WALLET',
      symbol: 'USDC',
    });
    act(() => root.unmount());

    render('USDC', CardProvider.RAIN);
    expect(root.root.findByType('RhinoNetworkGroup').props).toMatchObject({
      destinationType: 'RAIN_CARD',
      symbol: 'USDC',
    });
  });

  it('serves a Wirex cardholder’s USDC without rhino.fi’s card route', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain => ({
          ...chain,
          tokens: chain.tokens.map(token => ({
            ...token,
            routes: token.routes.filter(route => route.destinationType !== 'RAIN_CARD'),
          })),
        })),
      },
    };
    render('USDC', CardProvider.WIREX);
    expect(titles()).toEqual(['Polygon', 'Base', 'Arbitrum', 'Fuse']);
    act(() => root.unmount());

    render('USDC', CardProvider.RAIN);
    expect(titles()).toEqual(['Fuse']);
  });
});
