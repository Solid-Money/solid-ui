import React, { useEffect } from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';

import { CROSS_CHAIN_DEPOSIT_METADATA_KEY } from '@/constants/transaction';
import useDepositFromSolidUsdc from '@/hooks/useDepositFromSolidUsdc';
import { bridgeDeposit, createDeposit } from '@/lib/api';
import { executeTransactions } from '@/lib/execute';
import { DepositCategory, VaultType } from '@/lib/types';
import { getTokenAllowance } from '@/lib/utils/contract';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const SAFE = '0x000acC8042eA362149ce2b2709Fc497B6505634E';
const SPENDER = '0x9e852a0D1Bd9738d52b90a5E907138575822D69e';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

jest.mock('@/store/useUserStore', () => {
  // Jest factories resolve mocks before ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useUserStore: create(() => ({ updateUser: jest.fn() })) };
});
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'a', safeAddress: SAFE, suborgId: 'org', signWith: 'passkey' },
    safeAA: mockSafeAA,
  }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: any) => selector({ srcChainId: 1 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('wagmi', () => ({
  useBlockNumber: () => ({}),
  useReadContract: () => ({ data: 10_000_000_000n, refetch: jest.fn() }),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS: SPENDER,
}));
jest.mock('@/lib/utils/contract', () => ({ getTokenAllowance: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: (fn: () => unknown) => fn(),
}));
jest.mock('@/lib/api', () => ({
  bridgeDeposit: jest.fn().mockResolvedValue({ transactionHash: '0xdef' }),
  createDeposit: jest.fn().mockResolvedValue({ transactionHash: '0xdef' }),
}));
jest.mock('@/lib/deposit/telemetry', () => ({
  captureDepositError: (e: Error) => e.message,
  depositBreadcrumb: jest.fn(),
  trackDepositCompleted: jest.fn(),
  trackDepositInitiated: jest.fn(),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    createActivity: mockCreateActivity,
    updateActivity: jest.fn(),
  }),
}));

const mockSafeAA = jest.fn().mockResolvedValue({});
const mockCreateActivity = jest.fn().mockResolvedValue('activity');
const execute = executeTransactions as jest.Mock;
const allowance = getTokenAllowance as jest.Mock;

let hook: ReturnType<typeof useDepositFromSolidUsdc>;
let root: ReturnType<typeof create>;
function Harness({ address, token }: { address: `0x${string}`; token: string }) {
  const result = useDepositFromSolidUsdc(address, token, '10', DepositCategory.SAVINGS);
  useEffect(() => {
    hook = result;
  });
  return null;
}
const render = (address: `0x${string}`, token: string) =>
  act(() => {
    root = create(<Harness address={address} token={token} />);
  });

const approvedAmounts = () => {
  const [, transactions, , chain] = execute.mock.calls[0];
  expect(chain).toBe(mainnet);
  return transactions.map((tx: { to: string; data: `0x${string}` }) => {
    const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    expect(functionName).toBe('approve');
    expect(args?.[0]).toBe(SPENDER);
    return { to: tx.to, amount: args?.[1] };
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  execute.mockResolvedValue({ transactionHash: '0xabc' });
});
afterEach(() => act(() => root.unmount()));

// The direct deposit carries no token and the backend pulls USDC from it: a
// USDT deposit sent there was approved in USDT and then timed out waiting on USDC.
it('sends USDT on Ethereum through the bridge deposit, which is told the token', async () => {
  allowance.mockResolvedValue(0n);
  render(USDT, 'USDT');

  await act(async () => {
    expect(await hook.deposit('8713.87592')).toBe('activity');
  });

  expect(approvedAmounts()).toEqual([{ to: USDT, amount: 8_713_875_920n }]);
  expect(bridgeDeposit).toHaveBeenCalledWith(
    expect.objectContaining({
      srcToken: 'USDT',
      srcChainId: 1,
      eoaAddress: SAFE,
      amount: '8713.87592',
      category: DepositCategory.SAVINGS,
    }),
  );
  expect(createDeposit).not.toHaveBeenCalled();
  expect(mockCreateActivity).toHaveBeenCalledWith(
    expect.objectContaining({ metadata: { [CROSS_CHAIN_DEPOSIT_METADATA_KEY]: true } }),
  );
});

// USDT reverts an approve from one non-zero allowance to another, so a deposit
// left unpulled made every later USDT deposit fail in simulation.
it('clears a standing USDT allowance before raising it', async () => {
  allowance.mockResolvedValue(8_713_875_920n);
  render(USDT, 'USDT');

  await act(async () => {
    await hook.deposit('8713.87592');
  });

  expect(approvedAmounts()).toEqual([
    { to: USDT, amount: 0n },
    { to: USDT, amount: 17_427_751_840n },
  ]);
});

it('still deposits USDC on Ethereum directly', async () => {
  allowance.mockResolvedValue(0n);
  render(USDC, 'USDC');

  await act(async () => {
    await hook.deposit('100');
  });

  expect(approvedAmounts()).toEqual([{ to: USDC, amount: 100_000_000n }]);
  expect(createDeposit).toHaveBeenCalledWith(
    expect.objectContaining({ eoaAddress: SAFE, amount: '100', vault: VaultType.USDC }),
  );
  expect(bridgeDeposit).not.toHaveBeenCalled();
});
