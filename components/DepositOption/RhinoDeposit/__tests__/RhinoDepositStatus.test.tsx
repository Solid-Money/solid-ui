import React from 'react';

import RhinoDepositStatus from '@/components/DepositOption/RhinoDeposit/RhinoDepositStatus';

import type { RhinoDeposit } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ Check: 'Check' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Card/CardFund/DepositScanningIndicator', () => 'DepositScanningIndicator');
jest.mock('@/constants/bridge', () => ({ getBridgeChain: () => undefined }));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => ({ assets: undefined }),
}));
jest.mock('@/hooks/useRhinoDeposits', () => ({
  useRhinoDeposits: () => ({ deposit: mockDeposit.current }),
}));

const mockDeposit: { current?: Partial<RhinoDeposit> } = {};
const ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const onCompleteChange = jest.fn();

let root: any;
const element = () => (
  <RhinoDepositStatus
    enabled
    depositAddress={ADDRESS}
    chain="MATIC_POS"
    chainName="Polygon"
    addressType="EVM"
    destinationType="WALLET"
    onCompleteChange={onCompleteChange}
  />
);
const render = () => {
  act(() => {
    root = create(element());
  });
};
const rerender = () => {
  act(() => {
    root.update(element());
  });
};

const executed: Partial<RhinoDeposit> = {
  status: 'EXECUTED',
  chain: 'MATIC_POS',
  tokenSymbol: 'USDC',
  destinationType: 'WALLET',
  receiveSymbol: 'USDC',
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockDeposit.current = undefined;
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('RhinoDepositStatus onCompleteChange', () => {
  it('reports not complete while scanning or on its way', () => {
    render();
    mockDeposit.current = { ...executed, status: 'ACCEPTED' };
    rerender();

    expect(onCompleteChange).toHaveBeenCalled();
    expect(onCompleteChange).not.toHaveBeenCalledWith(true);
  });

  it('reports complete once rhino.fi has paid the Safe', () => {
    mockDeposit.current = executed;
    render();

    expect(onCompleteChange).toHaveBeenLastCalledWith(true);
  });

  // ETH is paid to an address our pipeline wraps from, so it is not done yet.
  it('does not report complete for a payout our pipeline goes on with', () => {
    mockDeposit.current = { ...executed, tokenSymbol: 'ETH', receiveSymbol: 'ETH' };
    render();

    expect(onCompleteChange).not.toHaveBeenCalledWith(true);
  });

  it('takes it back when it leaves the screen', () => {
    mockDeposit.current = executed;
    render();
    act(() => root.unmount());
    root = undefined;

    expect(onCompleteChange).toHaveBeenLastCalledWith(false);
  });
});
