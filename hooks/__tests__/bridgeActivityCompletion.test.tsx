import React, { useEffect } from 'react';

import useBridgeForWithdraw from '@/hooks/useBridgeForWithdraw';
import useBridgeToMainnetSoEth from '@/hooks/useBridgeToMainnetSoEth';
import { Status, TransactionStatus } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockUpdateActivity = jest.fn();
const mockOnUserOpHash = jest.fn();
const mockTrackTransaction = jest.fn();
const mockDelivery = jest.fn();
const mockSetSession = jest.fn();
const mockReceipt = { transactionHash: '0xreceipt' };
const mockUser = { userId: 'user', safeAddress: '0xsafe', suborgId: 'suborg', signWith: 'passkey' };
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('viem', () => ({ erc20Abi: [] }));
jest.mock('viem/chains', () => ({ fuse: { id: 122 } }));
jest.mock('viem/utils', () => ({
  encodeAbiParameters: jest.fn(),
  encodeFunctionData: jest.fn(),
  parseAbiParameters: jest.fn(),
  parseUnits: () => 10n,
}));
jest.mock('wagmi', () => ({ useReadContract: () => ({ data: 0n }) }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser, safeAA: async () => ({}) }),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: mockTrackTransaction,
    updateActivity: mockUpdateActivity,
  }),
}));
jest.mock('@/lib/config', () => ({ ADDRESSES: { fuse: {} } }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/soUsdWithdraw', () => ({
  SOUSD_WITHDRAW_CHAIN_ID: 8453,
  SOUSD_WITHDRAW_CHAINS: { 8453: { lzEid: 30184 } },
}));
jest.mock('@/lib/execute', () => ({
  USER_CANCELLED_TRANSACTION: 'cancelled',
  executeTransactions: async (
    _client: unknown,
    _calls: unknown,
    _error: unknown,
    _chain: unknown,
    onHash: (hash: string) => void,
  ) => {
    onHash('0xoperation');
    return mockReceipt;
  },
}));
jest.mock('@/lib/utils/layerzero', () => ({
  waitForLayerzeroTransaction: (...args: unknown[]) => mockDelivery(...args),
}));
jest.mock('@/store/useWithdrawSessionStore', () => ({
  useWithdrawSessionStore: { getState: () => ({ setSession: mockSetSession }) },
}));

let usd: ReturnType<typeof useBridgeForWithdraw>;
let eth: ReturnType<typeof useBridgeToMainnetSoEth>;
const Probe = () => {
  const usdResult = useBridgeForWithdraw();
  const ethResult = useBridgeToMainnetSoEth();
  useEffect(() => {
    usd = usdResult;
    eth = ethResult;
  });
  return null;
};

it.each(['USD', 'ETH'] as const)(
  'completes the same %s activity only after bridge delivery',
  async vault => {
    jest.clearAllMocks();
    mockTrackTransaction.mockImplementation((_params, execute) => execute(mockOnUserOpHash));
    let finish!: (value: unknown) => void;
    mockDelivery.mockReturnValue(new Promise(resolve => (finish = resolve)));
    let tree: any;
    act(() => {
      tree = create(<Probe />);
    });
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = vault === 'USD' ? usd.bridge('10') : eth.bridgeSoEth('10');
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const params = mockTrackTransaction.mock.calls[0][0];
    expect(params.clientTxId).toEqual(expect.any(String));
    expect(mockOnUserOpHash).toHaveBeenCalledWith('0xoperation');
    expect(mockSetSession).toHaveBeenCalledWith(expect.objectContaining({ vault, amount: '10' }));
    expect(mockUpdateActivity).not.toHaveBeenCalled();
    await act(async () => {
      finish({ data: [{ status: { name: 'DELIVERED' } }] });
      await pending;
    });
    expect(mockUpdateActivity).toHaveBeenCalledWith(
      params.clientTxId,
      expect.objectContaining({ status: TransactionStatus.SUCCESS }),
    );
    expect(vault === 'USD' ? usd.bridgeStatus : eth.bridgeSoEthStatus).toBe(Status.SUCCESS);
    act(() => tree.unmount());
  },
);
