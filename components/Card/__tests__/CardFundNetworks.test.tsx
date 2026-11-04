import React from 'react';
import { arbitrum, base, fuse, polygon } from 'viem/chains';

import CardFundNetworks from '@/components/Card/CardFund/CardFundNetworks';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';

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
  const { resolveRhinoRow } = jest.requireActual('@/lib/rhinoDeposit');
  return {
    useRhinoNetworkRows: (filter: object, rows: { chainId: number }[]) => ({
      rows: rows.map(row => ({
        row,
        state: resolveRhinoRow(mockRhino.current, { ...filter, chainId: row.chainId }),
      })),
      retry: mockRhino.current.retry,
    }),
  };
});

const mockNetworks = (symbol: string) =>
  symbol === 'EURC'
    ? [{ chainId: base.id, name: 'Base', icon: 'base' }]
    : [
        { chainId: polygon.id, name: 'Polygon', icon: 'polygon' },
        { chainId: base.id, name: 'Base', icon: 'base' },
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
const render = (symbol = 'USDC') => {
  const onSelect = jest.fn();
  act(() => {
    root = create(<CardFundNetworks symbol={symbol} onSelect={onSelect} />);
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

  it('says so when no row takes the token', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BASE'),
      },
    };
    render('EURC');

    expect(rows()).toHaveLength(0);
    expect(texts()).toContain('No network takes EURC right now.');
  });
});
