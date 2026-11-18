import React from 'react';

import { useRainRealTimeFunding } from '@/hooks/useRainRealTimeFunding';

import type { RainRtfChain, RainRtfStatus } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The approval mutation checks every pending chain's operator before the
 * first signature. Checked here through the hook itself, because a check moved
 * back inside the per-chain loop would pass every helper test while signing
 * and recording consent for the chains ahead of the bad one.
 */

const mockState: { status?: RainRtfStatus; mutationFn?: (terms: string) => Promise<unknown> } = {};
const mockSafeAA = jest.fn();
const mockExecuteTransactions = jest.fn();
const mockConfirmRainRtf = jest.fn();
const mockGetChain = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockState.status, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { mutationFn: (terms: string) => Promise<unknown> }) => {
    mockState.mutationFn = options.mutationFn;
    return { mutateAsync: jest.fn(), isPending: false };
  },
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 'user-1',
      suborgId: 'suborg-1',
      signWith: 'signer-1',
      safeAddress: '0x1111111111111111111111111111111111111111',
    },
    safeAA: mockSafeAA,
  }),
}));
jest.mock('@/hooks/useCardProvider', () => ({ useCardProvider: () => ({ provider: 'rain' }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({
  confirmRainRtf: (...args: unknown[]) => mockConfirmRainRtf(...args),
  getRainRtfStatus: jest.fn(),
}));
jest.mock('@/lib/errors', () => ({
  ...jest.requireActual('@/lib/errors/UserCopyError'),
  getUserErrorMessage: () => 'Check the details and try again.',
  sanitizeTechnicalMessage: () => 'Sanitized error',
}));
jest.mock('@/lib/execute', () => ({
  USER_CANCELLED_TRANSACTION: 'cancelled',
  executeTransactions: (...args: unknown[]) => mockExecuteTransactions(...args),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/wagmi', () => ({ getChain: (id: number) => mockGetChain(id) }));

const UINT256_MAX = (2n ** 256n - 1n).toString();
const SANDBOX_OPERATOR = '0x5a6e6b0d5ea051cfff9b3dcc2aa8dac226458f29';
const ROGUE = '0x9999999999999999999999999999999999999999';

const chain = (chainId: number, name: string, operator: string): RainRtfChain => ({
  chainId,
  name,
  environment: 'sandbox',
  collateralAddress: '0x2222222222222222222222222222222222222222',
  assets: [
    {
      symbol: 'USDC',
      tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
      tokenDecimals: 6,
      spenders: [
        {
          kind: 'collateral',
          address: '0x2222222222222222222222222222222222222222',
          currentAllowance: '0',
          isApproved: false,
        },
        { kind: 'operator', address: operator, currentAllowance: '0', isApproved: false },
      ],
      walletBalance: '0',
      isApproved: false,
    },
  ],
  walletAddress: '0x1111111111111111111111111111111111111111',
  pendingApprovals: 2,
  isApproved: false,
  hasConsent: false,
  consentAt: null,
  transactionHash: null,
  unavailableReason: null,
});

const status = (chains: RainRtfChain[]): RainRtfStatus => ({
  tenantEnabled: true,
  eligible: true,
  ineligibleReason: null,
  maxAllowance: UINT256_MAX,
  terms: {
    version: '2026-10-04',
    url: 'https://example.test/rtf',
    body: 'terms',
    consentLabel: 'I authorize transfers according to the Real-Time Funding Terms.',
  },
  chains,
});

const Probe = () => {
  useRainRealTimeFunding();
  return null;
};

const approveWith = async (chains: RainRtfChain[]) => {
  mockState.status = status(chains);
  let tree: any;
  act(() => {
    tree = create(<Probe />);
  });
  try {
    let outcome: unknown;
    await act(async () => {
      outcome = await mockState.mutationFn!('2026-10-04').catch((error: unknown) => error);
    });
    return outcome;
  } finally {
    act(() => tree.unmount());
  }
};

describe('useRainRealTimeFunding approval preflight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChain.mockImplementation((id: number) => ({ id }));
    mockSafeAA.mockResolvedValue({ client: true });
    mockExecuteTransactions.mockResolvedValue({ transactionHash: '0xabc' });
    mockConfirmRainRtf.mockResolvedValue({});
  });

  it('signs nothing when a later chain names an unknown operator', async () => {
    const outcome = await approveWith([
      chain(84532, 'Base Sepolia', SANDBOX_OPERATOR),
      chain(421614, 'Arbitrum Sepolia', ROGUE),
    ]);

    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toContain('Arbitrum Sepolia');
    expect(mockSafeAA).not.toHaveBeenCalled();
    expect(mockExecuteTransactions).not.toHaveBeenCalled();
    expect(mockConfirmRainRtf).not.toHaveBeenCalled();
  });

  it('signs and records every chain when each operator is Rain’s', async () => {
    const outcome = await approveWith([
      chain(84532, 'Base Sepolia', SANDBOX_OPERATOR),
      chain(421614, 'Arbitrum Sepolia', SANDBOX_OPERATOR),
    ]);

    expect(outcome).toEqual({ chainIds: [84532, 421614], requested: 2 });
    expect(mockExecuteTransactions).toHaveBeenCalledTimes(2);
    expect(mockConfirmRainRtf).toHaveBeenCalledTimes(2);
  });
});
