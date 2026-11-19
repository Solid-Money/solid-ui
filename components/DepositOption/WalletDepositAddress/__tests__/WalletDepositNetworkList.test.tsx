import React from 'react';
import { base } from 'viem/chains';

import { WalletDepositNetworkList } from '@/components/DepositOption/WalletDepositAddress/WalletDepositSelectors';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({ Check: 'Check', ChevronDown: 'ChevronDown' }));
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoChainIcon', () => 'RhinoChainIcon');
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice',
  () => 'RhinoNetworksNotice',
);
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: null }),
}));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: true, isLoading: false }),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector({}),
}));

const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: jest.fn(),
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };

const render = (symbol: string) => {
  let root: any;
  act(() => {
    root = create(
      <WalletDepositNetworkList
        chainId={base.id}
        symbol={symbol}
        onSelect={jest.fn()}
        onSelectExtra={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
  });
  return root;
};

const texts = (root: any): string[] =>
  root.root.findAll((node: any) => node.type === 'Text').map((node: any) => node.props.children);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockRhino.current = READY;
});

/** rhino.fi's other chains sit in the list with the rest, not in a section of their own. */
describe('WalletDepositNetworkList', () => {
  it('lists Tron and Solana after the list’s own rows, with no "More networks" heading', () => {
    const root = render('USDT');
    const names = texts(root);

    expect(names).not.toContain('More networks');
    expect(names).toEqual(expect.arrayContaining(['Tron', 'Solana']));
    // The list's own rows first, then rhino.fi's.
    expect(names.indexOf('Base')).toBeLessThan(names.indexOf('Tron'));
  });
});
