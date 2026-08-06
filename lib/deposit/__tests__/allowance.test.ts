import { decodeFunctionData, erc20Abi, maxUint256 } from 'viem';

import { buildDepositApproval } from '@/lib/deposit/allowance';
import { getTokenAllowance } from '@/lib/utils/contract';

jest.mock('@/lib/utils/contract', () => ({
  getTokenAllowance: jest.fn(),
}));

const mockedGetTokenAllowance = getTokenAllowance as jest.MockedFunction<typeof getTokenAllowance>;

const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const OWNER = '0x2A17c1D522dacBd04742fC45e4691fd43b932826' as const;
const SPENDER = '0x9e852a0D1Bd9738d52b90a5E907138575822D69e' as const;

const approvedAmount = (data: `0x${string}`): bigint => {
  const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data });
  expect(functionName).toBe('approve');
  expect(args?.[0]).toBe(SPENDER);
  return args?.[1] as bigint;
};

const build = (amount: bigint) =>
  buildDepositApproval({
    tokenAddress: TOKEN,
    owner: OWNER,
    spender: SPENDER,
    amount,
    chainId: 8453,
  });

describe('buildDepositApproval', () => {
  beforeEach(() => mockedGetTokenAllowance.mockReset());

  it('approves just the amount when nothing is approved yet', async () => {
    mockedGetTokenAllowance.mockResolvedValue(0n);

    const call = await build(6_000_000n);

    expect(call.to).toBe(TOKEN);
    expect(call.value).toBe(0n);
    expect(approvedAmount(call.data)).toBe(6_000_000n);
  });

  it('adds to an allowance a pending deposit is still waiting on', async () => {
    // The bug this exists to prevent: deposit A approved 0.02 and has not been
    // pulled yet. Approving a bare 0.11 for deposit B would overwrite it, and A
    // could never settle. 0.13 lets both pulls take their own share.
    mockedGetTokenAllowance.mockResolvedValue(20_000n);

    const call = await build(110_000n);

    expect(approvedAmount(call.data)).toBe(130_000n);
  });

  it('falls back to the bare amount when the allowance read fails', async () => {
    mockedGetTokenAllowance.mockRejectedValue(new Error('rpc down'));

    const call = await build(6_000_000n);

    expect(approvedAmount(call.data)).toBe(6_000_000n);
  });

  it('saturates instead of overflowing an existing unlimited approval', async () => {
    mockedGetTokenAllowance.mockResolvedValue(maxUint256);

    const call = await build(1n);

    expect(approvedAmount(call.data)).toBe(maxUint256);
  });
});
