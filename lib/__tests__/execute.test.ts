import { getUserErrorMessage } from '@/lib/errors/classify';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import {
  executeTransactions,
  sendUserOperationPayingGasIfRefused,
  USER_CANCELLED_TRANSACTION,
} from '@/lib/execute';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('permissionless', () => ({
  createSmartAccountClient: (config: unknown) => {
    mockUnsponsoredConfig = config;
    return mockUnsponsored;
  },
}));
jest.mock('permissionless/actions', () => ({ getAccountNonce: async () => 7n }));
jest.mock('@/lib/config', () => ({ USER: { pimlicoUrl: () => 'https://bundler.test' } }));
jest.mock('@/lib/pimlico', () => ({
  pimlicoClient: () => ({ getUserOperationGasPrice: jest.fn() }),
}));
jest.mock('@/lib/wagmi', () => ({
  publicClient: () => ({
    getBalance: mockGetBalance,
    waitForTransactionReceipt: async () => ({ status: 'success', transactionHash: '0xtx' }),
  }),
}));
jest.mock('@/store/useNetworkFeeStore', () => ({
  askToPayNetworkFee: (request: unknown) => mockAsk(request),
}));

let mockUnsponsoredConfig: any;
const mockGetBalance = jest.fn();
const mockAsk = jest.fn();
const mockUnsponsored = {
  prepareUserOperation: jest.fn(),
  sendUserOperation: jest.fn(),
};

const chain = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as any;

/** How viem surfaced Pimlico's refusal for every Ethereum swap on Oct 14. */
const policyRefusal = Object.assign(
  new Error('Invalid parameters were provided to the RPC method.'),
  {
    name: 'InvalidParamsRpcError',
    details: 'sponsorshipPolicy perOpMaximumUsd reached',
  },
);

/** A first swap out of a new Safe at 1 gwei, unsponsored: 0.00112567 ETH up front. */
const prepared = {
  sender: '0xsafe',
  callData: '0xcall',
  callGasLimit: 598_032n,
  verificationGasLimit: 447_206n,
  preVerificationGas: 80_432n,
  maxFeePerGas: 1_000_000_000n,
  maxPriorityFeePerGas: 100_000_000n,
  nonce: 7n,
  signature: '0xstub',
};
const prefund = (598_032n + 447_206n + 80_432n) * 1_000_000_000n;

/** 0.005 ETH out, plus a 0.0001 ETH bridge fee. */
const calls = [{ to: '0xlifi', data: '0xa6010a66', value: 5_100_000_000_000_000n }];

let sponsored: any;

beforeEach(() => {
  jest.clearAllMocks();
  sponsored = {
    account: { address: '0xsafe' },
    sendUserOperation: jest.fn(),
    waitForUserOperationReceipt: jest.fn(async () => ({
      success: true,
      receipt: { transactionHash: '0xtx' },
    })),
  };
  mockUnsponsored.prepareUserOperation.mockResolvedValue(prepared);
  mockUnsponsored.sendUserOperation.mockResolvedValue('0xselfpaid');
});

const run = () => executeTransactions(sponsored, calls, 'Swap failed', chain);

it('sends sponsored when the paymaster covers it, and asks nothing', async () => {
  sponsored.sendUserOperation.mockResolvedValue('0xsponsored');

  const result: any = await run();

  expect(result.userOpHash).toBe('0xsponsored');
  expect(mockAsk).not.toHaveBeenCalled();
  expect(mockUnsponsored.prepareUserOperation).not.toHaveBeenCalled();
});

describe('a transaction over the sponsorship cap', () => {
  beforeEach(() => sponsored.sendUserOperation.mockRejectedValue(policyRefusal));

  it('asks with the most the fee can be, then lets the Safe pay it', async () => {
    mockGetBalance.mockResolvedValue(prefund + calls[0].value);
    mockAsk.mockResolvedValue(true);

    const result: any = await run();

    expect(mockUnsponsoredConfig).toMatchObject({ account: sponsored.account, chain });
    expect(mockUnsponsoredConfig.paymaster).toBeUndefined();
    expect(mockUnsponsored.prepareUserOperation).toHaveBeenCalledWith({ calls, nonce: 7n });
    expect(mockAsk).toHaveBeenCalledWith({
      chainId: 1,
      network: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      maxFee: prefund,
    });
    // Sent as agreed, and signed for real: the stub signature is not reused.
    const { signature: _stub, ...unsigned } = prepared;
    expect(mockUnsponsored.sendUserOperation).toHaveBeenCalledWith(unsigned);
    expect(result).toMatchObject({ userOpHash: '0xselfpaid', transactionHash: '0xtx' });
  });

  it('sends nothing when the user declines', async () => {
    mockGetBalance.mockResolvedValue(prefund + calls[0].value);
    mockAsk.mockResolvedValue(false);

    await expect(run()).resolves.toBe(USER_CANCELLED_TRANSACTION);
    expect(mockUnsponsored.sendUserOperation).not.toHaveBeenCalled();
  });

  it('says what is missing, without asking, when the Safe can’t pay', async () => {
    mockGetBalance.mockResolvedValue(prefund + calls[0].value - 1n);

    const error = await run().catch(e => e);

    expect(error).toBeInstanceOf(UserCopyError);
    expect(getUserErrorMessage(error)).toBe(
      'Not enough ETH on Ethereum to pay the network fee (up to 0.00113 ETH). Lower the amount or add ETH.',
    );
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockUnsponsored.sendUserOperation).not.toHaveBeenCalled();
  });

  it('reads a bundler prefund refusal during estimation the same way', async () => {
    mockUnsponsored.prepareUserOperation.mockRejectedValue(
      Object.assign(new Error('UserOperation reverted'), { details: "AA21 didn't pay prefund" }),
    );

    const error = await run().catch(e => e);

    expect(error).toBeInstanceOf(UserCopyError);
    expect(mockAsk).not.toHaveBeenCalled();
  });
});

it('leaves any other failure as it was', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const other = new Error('Execution reverted');
  sponsored.sendUserOperation.mockRejectedValue(other);

  await expect(run()).rejects.toBe(other);
  expect(mockUnsponsored.prepareUserOperation).not.toHaveBeenCalled();
});

describe('an operation sent outside executeTransactions', () => {
  // Collateral withdrawal deploys the Safe with a no-op first, at the
  // account's next nonce.
  const deploy = [{ to: '0xsafe', data: '0x', value: 0n }];

  it('gets the same offer, at the account’s own nonce', async () => {
    sponsored.sendUserOperation.mockRejectedValue(policyRefusal);
    mockGetBalance.mockResolvedValue(prefund);
    mockAsk.mockResolvedValue(true);

    await expect(
      sendUserOperationPayingGasIfRefused(sponsored, deploy, undefined, chain),
    ).resolves.toBe('0xselfpaid');
    expect(sponsored.sendUserOperation).toHaveBeenCalledWith({ calls: deploy, nonce: undefined });
    expect(mockUnsponsored.prepareUserOperation).toHaveBeenCalledWith({
      calls: deploy,
      nonce: undefined,
    });
  });

  it('resolves to nothing when the user declines', async () => {
    sponsored.sendUserOperation.mockRejectedValue(policyRefusal);
    mockGetBalance.mockResolvedValue(prefund);
    mockAsk.mockResolvedValue(false);

    await expect(
      sendUserOperationPayingGasIfRefused(sponsored, deploy, undefined, chain),
    ).resolves.toBeUndefined();
    expect(mockUnsponsored.sendUserOperation).not.toHaveBeenCalled();
  });
});
