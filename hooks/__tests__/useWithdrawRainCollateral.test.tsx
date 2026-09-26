import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
import * as Sentry from '@sentry/react-native';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  withdrawCardCollateral: jest.fn().mockResolvedValue({
    chainId: 1,
    collateralProxy: '0xproxy',
    assetAddress: '0xasset',
    amount: '1000000',
    recipient: '0xrecipient',
    expiresAt: '9999999999',
    executorPublisherSalt: '0xsalt',
    executorPublisherSig: '0xsig',
    coordinatorAddress: '0xcoordinator',
  }),
}));

jest.mock('@/lib/wagmi', () => ({
  publicClient: jest.fn().mockReturnValue({
    readContract: jest.fn(),
    getCode: jest.fn().mockResolvedValue('0x1234'),
  }),
  getChain: jest.fn().mockReturnValue({ id: 1, name: 'Ethereum' }),
}));

jest.mock('viem/actions', () => ({
  readContract: jest.fn().mockResolvedValue(BigInt(0)),
}));

jest.mock('viem', () => ({
  encodeFunctionData: jest.fn().mockReturnValue('0xcalldata'),
  toHex: jest.fn().mockReturnValue('0xrandomsalt'),
}));

const mockSignTypedData = jest.fn();
const mockSafeAA = jest.fn().mockResolvedValue({
  account: {
    signTypedData: mockSignTypedData,
  },
  sendUserOperation: jest.fn(),
  waitForUserOperationReceipt: jest.fn(),
});

jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      safeAddress: '0xsafe',
      suborgId: 'suborg-1',
      signWith: 'passkey',
      userId: 'user-1',
    },
    safeAA: mockSafeAA,
  }),
}));

jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: (_params: unknown, execute: (onHash: () => void) => Promise<unknown>) =>
      execute(jest.fn()),
  }),
}));

jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn().mockResolvedValue('0xtxhash'),
  isWebAuthnUserCancelledError: jest
    .fn()
    .mockImplementation((err: any) => err?.message?.includes('user cancelled')),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));

import useWithdrawRainCollateral from '../useWithdrawRainCollateral';
import { Status } from '@/lib/types';

function TestComponent({ onResult }: { onResult: (hook: any) => void }) {
  const hook = useWithdrawRainCollateral();
  onResult(hook);
  return null;
}

describe('useWithdrawRainCollateral', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call Sentry.captureException when user cancels the passkey prompt during signTypedData', async () => {
    const cancelError = new Error('Failed to sign: The user cancelled the request.');

    mockSignTypedData.mockRejectedValueOnce(cancelError);

    let hookRef: any;
    await act(async () => {
      create(<TestComponent onResult={hook => (hookRef = hook)} />);
    });

    await act(async () => {
      try {
        await hookRef.withdrawCollateral({ amount: '10', recipientAddress: '0xrecipient' });
      } catch {
        // may not throw for user cancellations
      }
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(hookRef.status).toBe(Status.IDLE);
  });

  it('calls Sentry.captureException for non-cancellation errors during signTypedData', async () => {
    const networkError = new Error('Network failure');
    mockSignTypedData.mockRejectedValueOnce(networkError);

    let hookRef: any;
    await act(async () => {
      create(<TestComponent onResult={hook => (hookRef = hook)} />);
    });

    await act(async () => {
      try {
        await hookRef.withdrawCollateral({ amount: '10', recipientAddress: '0xrecipient' });
      } catch {
        // expected
      }
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      networkError,
      expect.objectContaining({ tags: { operation: 'withdraw_rain_collateral' } }),
    );
    expect(hookRef.status).toBe(Status.ERROR);
  });
});
