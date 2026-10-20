import React, { useEffect } from 'react';
import { zeroAddress } from 'viem';

import useDepositFromEOAEur, {
  EOA_DEPOSIT_NOT_CONFIGURED,
  EOA_DEPOSIT_UNAVAILABLE,
} from '@/hooks/useDepositFromEOAEur';
import { createDeposit } from '@/lib/api';
import { Status } from '@/lib/types';
import { checkAndSetAllowanceToken } from '@/lib/utils/contract';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';
const EOA = '0x1111111111111111111111111111111111111111';
const DEPOSIT_WALLET = '0x2222222222222222222222222222222222222222';

let mockSpender = DEPOSIT_WALLET;
const mockSwitchChain = jest.fn();
const mockCreateActivity = jest.fn().mockResolvedValue('activity');
const mockUpdateActivity = jest.fn();

jest.mock('@/lib/config', () => ({
  // Read at call time, so each test can set the build's deposit wallet.
  get EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS() {
    return mockSpender;
  },
  EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT: '10',
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'a', safeAddress: '0xsafe', suborgId: 'org' } }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: any) =>
    selector({
      srcChainId: 8453,
      externalWallet: { account: { address: EOA }, wallet: { switchChain: mockSwitchChain } },
    }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: any) => selector({ updateUser: jest.fn() }),
}));
// 1,000 EURC in the external wallet.
jest.mock('wagmi', () => ({
  useBlockNumber: () => ({}),
  useReadContract: () => ({ data: 1_000_000_000n, refetch: jest.fn() }),
}));
jest.mock('@/lib/deposit/soEurc', () => ({ SOEURC_DECIMALS: 6 }));
jest.mock('@/lib/deposit/telemetry', () => ({
  captureDepositError: () => '',
  depositBreadcrumb: jest.fn(),
  trackDepositCompleted: jest.fn(),
  trackDepositInitiated: jest.fn(),
  trackDepositValidated: jest.fn(),
}));
jest.mock('@/lib/thirdweb', () => ({ getChain: () => ({ id: 8453 }) }));
jest.mock('@/lib/api', () => ({ createDeposit: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/utils/contract', () => ({
  checkAndSetAllowanceToken: jest.fn(),
  getTransactionReceipt: jest.fn(),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    createActivity: mockCreateActivity,
    updateActivity: mockUpdateActivity,
  }),
}));

const approve = checkAndSetAllowanceToken as jest.Mock;
const backendDeposit = createDeposit as jest.Mock;
let hook: ReturnType<typeof useDepositFromEOAEur>;
let statuses: Status[];
let root: ReturnType<typeof create>;
function Harness() {
  const result = useDepositFromEOAEur(EURC, 'EURC', '10');
  statuses.push(result.depositStatus.status);
  useEffect(() => {
    hook = result;
  });
  return null;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockSpender = DEPOSIT_WALLET;
  statuses = [];
  act(() => {
    root = create(<Harness />);
  });
});
afterEach(() => act(() => root.unmount()));

// EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS defaults to '': approving that can only fail,
// and only after the wallet was asked to switch network.
it.each([
  ['unset', ''],
  ['not an address', 'not-an-address'],
  ['the zero address', zeroAddress],
])('refuses before any wallet prompt when the deposit wallet is %s', async (_label, spender) => {
  mockSpender = spender;
  await act(async () => {
    await expect(hook.deposit('100')).rejects.toThrow(EOA_DEPOSIT_NOT_CONFIGURED);
  });

  expect(mockSwitchChain).not.toHaveBeenCalled();
  expect(approve).not.toHaveBeenCalled();
  expect(mockCreateActivity).not.toHaveBeenCalled();
  expect(backendDeposit).not.toHaveBeenCalled();
  expect(statuses).not.toContain(Status.PENDING);
  expect(hook.depositStatus.status).toBe(Status.ERROR);
  expect(hook.error).toBe(EOA_DEPOSIT_UNAVAILABLE);
});

it('approves the configured deposit wallet and asks the backend for a EUR deposit', async () => {
  backendDeposit.mockResolvedValue({ transactionHash: '0xhash' });
  await act(async () => {
    expect(await hook.deposit('100')).toBe('activity');
  });

  expect(mockSwitchChain).toHaveBeenCalledWith({ id: 8453 });
  expect(approve).toHaveBeenCalledWith(EURC, EOA, DEPOSIT_WALLET, 100_000_000n, 8453);
  expect(backendDeposit).toHaveBeenCalledWith(
    expect.objectContaining({
      eoaAddress: EOA,
      amount: '100',
      trackingId: 'activity',
      vault: 'eur',
    }),
  );
  expect(hook.depositStatus.status).toBe(Status.SUCCESS);
});
