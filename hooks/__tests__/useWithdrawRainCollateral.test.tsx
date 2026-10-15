import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';

import useWithdrawRainCollateral from '@/hooks/useWithdrawRainCollateral';
import {
  executeTransactions,
  sendUserOperationPayingGasIfRefused,
  USER_CANCELLED_TRANSACTION,
} from '@/lib/execute';
import { publicClient } from '@/lib/wagmi';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('viem', () => ({
  encodeFunctionData: () => '0xdata',
  toHex: () => '0xsalt',
}));
jest.mock('viem/actions', () => ({ readContract: jest.fn().mockResolvedValue(0n) }));
jest.mock('@/lib/types', () => ({
  Status: { IDLE: 'idle', PENDING: 'pending', SUCCESS: 'success', ERROR: 'error' },
  TransactionType: { WITHDRAW_COLLATERAL: 'withdraw_collateral' },
}));
jest.mock('@/lib/api', () => ({
  withdrawCardCollateral: jest.fn().mockResolvedValue({
    chainId: 1,
    collateralProxy: '0xproxy',
    coordinatorAddress: '0xcoordinator',
    assetAddress: '0xusdc',
    amount: '10000000',
    recipient: '0xsafe',
    expiresAt: '0',
    executorPublisherSalt: '0x01',
    executorPublisherSig: '0x02',
  }),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  sendUserOperationPayingGasIfRefused: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/lib/smartAccountSigning', () => ({
  toErc1271Signature: (signature: string) => signature,
  waitForSmartAccountDeployment: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/wagmi', () => ({
  getChain: () => ({ id: 1, name: 'Ethereum' }),
  publicClient: jest.fn(),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: (_params: unknown, execute: (onHash: () => void) => Promise<unknown>) =>
      execute(jest.fn()),
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'user-1', safeAddress: '0xsafe', suborgId: 'org-1', signWith: 'passkey' },
    safeAA: jest.fn().mockResolvedValue({
      account: { signTypedData: jest.fn().mockResolvedValue('0xsig') },
      waitForUserOperationReceipt: jest.fn().mockResolvedValue({}),
    }),
  }),
}));

const captureException = Sentry.captureException as jest.Mock;
const sendPayingGas = sendUserOperationPayingGasIfRefused as jest.Mock;
const execute = executeTransactions as jest.Mock;
const getCode = jest.fn();

let hook: ReturnType<typeof useWithdrawRainCollateral>;
let root: ReturnType<typeof create>;

function Harness() {
  const result = useWithdrawRainCollateral();
  useEffect(() => {
    hook = result;
  });
  return null;
}

const params = { amount: '10', recipientAddress: '0xsafe' };

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (publicClient as jest.Mock).mockReturnValue({ getCode });
  getCode.mockResolvedValue('0x6080');
  execute.mockResolvedValue({ transaction: { transactionHash: '0xhash' } });
  act(() => {
    root = create(<Harness />);
  });
});
afterEach(() => act(() => root?.unmount()));

it('treats declining the Safe deployment’s network fee as a cancel, not a failure', async () => {
  getCode.mockResolvedValue('0x');
  sendPayingGas.mockResolvedValueOnce(undefined);

  await act(async () => {
    await expect(hook.withdrawCollateral(params)).rejects.toThrow('User cancelled transaction');
  });

  expect(execute).not.toHaveBeenCalled();
  expect(captureException).not.toHaveBeenCalled();
  expect(hook.status).toBe('idle');
  expect(hook.error).toBeNull();
});

it('treats a cancelled withdrawal as a cancel too', async () => {
  execute.mockResolvedValueOnce({ transaction: USER_CANCELLED_TRANSACTION });

  await act(async () => {
    await expect(hook.withdrawCollateral(params)).rejects.toThrow('User cancelled transaction');
  });

  expect(captureException).not.toHaveBeenCalled();
  expect(hook.status).toBe('idle');
});

it('still reports a real failure', async () => {
  execute.mockRejectedValueOnce(new Error('Rain collateral withdrawal failed'));

  await act(async () => {
    await expect(hook.withdrawCollateral(params)).rejects.toThrow(
      'Rain collateral withdrawal failed',
    );
  });

  expect(captureException).toHaveBeenCalledTimes(1);
  expect(hook.status).toBe('error');
  expect(hook.error).toBe('Rain collateral withdrawal failed');
});
