import { decodeFunctionData, erc20Abi } from 'viem';

import {
  buildApprovalBatch,
  describeApprovalWork,
  formatTokenAmount,
  pendingApprovalsFor,
  selectRtfChains,
  shouldOfferRtf,
} from '@/lib/utils/realTimeFunding';

import type { RainRtfAsset, RainRtfChain, RainRtfStatus } from '@/lib/types';

const UINT256_MAX = (2n ** 256n - 1n).toString();

const COLLATERAL = '0x2222222222222222222222222222222222222222';
const OPERATOR = '0x5a6e6b0d5ea051cfff9b3dcc2aa8dac226458f29';
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
const EURC = '0x4444444444444444444444444444444444444444';

/** One asset with both spenders, unapproved unless told otherwise. */
const asset = (overrides: Partial<RainRtfAsset> = {}): RainRtfAsset => ({
  symbol: 'USDC',
  tokenAddress: USDC,
  tokenDecimals: 6,
  spenders: [
    { kind: 'collateral', address: COLLATERAL, currentAllowance: '0', isApproved: false },
    { kind: 'operator', address: OPERATOR, currentAllowance: '0', isApproved: false },
  ],
  walletBalance: '0',
  isApproved: false,
  ...overrides,
});

const chain = (overrides: Partial<RainRtfChain> = {}): RainRtfChain => {
  const assets = overrides.assets ?? [asset()];
  return {
    chainId: 84532,
    name: 'Base Sepolia',
    environment: 'sandbox',
    collateralAddress: COLLATERAL,
    assets,
    walletAddress: '0x1111111111111111111111111111111111111111',
    pendingApprovals: assets.reduce(
      (total, entry) => total + entry.spenders.filter(s => !s.isApproved).length,
      0,
    ),
    isApproved: assets.length > 0 && assets.every(entry => entry.isApproved),
    hasConsent: false,
    consentAt: null,
    transactionHash: null,
    unavailableReason: null,
    ...overrides,
  };
};

const status = (overrides: Partial<RainRtfStatus> = {}): RainRtfStatus => ({
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
  chains: [chain()],
  ...overrides,
});

/** The (spender, amount) an `approve` call actually carries. */
const decodeApprove = (data: `0x${string}`) => {
  const decoded = decodeFunctionData({ abi: erc20Abi, data });
  expect(decoded.functionName).toBe('approve');
  const [spender, amount] = decoded.args as [string, bigint];
  return { spender: spender.toLowerCase(), amount };
};

describe('formatTokenAmount', () => {
  it('formats a smallest-units balance at the token’s decimals', () => {
    expect(formatTokenAmount('25000000', 6)).toBe('25');
    expect(formatTokenAmount('25500000', 6)).toBe('25.5');
    expect(formatTokenAmount('25450000', 6)).toBe('25.45');
    expect(formatTokenAmount('0', 6)).toBe('0');
  });

  it('pads the fraction before slicing it', () => {
    // 1 wei of a 6dp token is 0.000001, not 0.1. Slicing the fraction before
    // padding it to the token's precision is the bug this pins: it would read
    // "1" as the first fractional digit.
    expect(formatTokenAmount('1', 6)).toBe('0');
    expect(formatTokenAmount('1', 6, 6)).toBe('0.000001');
    expect(formatTokenAmount('100001', 6, 6)).toBe('0.100001');
  });

  it('groups the whole part', () => {
    expect(formatTokenAmount('1234567890000', 6)).toBe('1,234,567.89');
  });

  it('survives uint256 max without rounding it', () => {
    // The whole reason this takes a string: an unlimited allowance is 78
    // digits, and `Number` turns it into 1.1579208923731619e+77 and then
    // formats that confidently.
    expect(formatTokenAmount(UINT256_MAX, 6)).toContain(
      '115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457',
    );
  });

  it('returns null for anything that is not a non-negative integer string', () => {
    // Never 0 — a cardholder would read that as "my wallet is empty", which
    // is a different and far more alarming thing than "we could not look".
    expect(formatTokenAmount(null, 6)).toBeNull();
    expect(formatTokenAmount(undefined, 6)).toBeNull();
    expect(formatTokenAmount('', 6)).toBeNull();
    expect(formatTokenAmount('12.5', 6)).toBeNull();
    expect(formatTokenAmount('-1', 6)).toBeNull();
    expect(formatTokenAmount('abc', 6)).toBeNull();
    expect(formatTokenAmount('100', -1)).toBeNull();
    expect(formatTokenAmount('100', 1.5)).toBeNull();
  });
});

describe('pendingApprovalsFor', () => {
  it('is one per (token, spender) pair, across every asset', () => {
    // The product that the whole feature turns on. An ERC-20 allowance is
    // scoped to one (token, owner, spender) triple, so two assets with two
    // spenders is four approvals — treating the chain as the unit would
    // approve one asset and leave the card declining on the other.
    const pending = pendingApprovalsFor(
      chain({ assets: [asset(), asset({ symbol: 'EURC', tokenAddress: EURC })] }),
    );

    expect(pending).toHaveLength(4);
    expect(pending.map(entry => `${entry.symbol}->${entry.spenderAddress}`)).toEqual([
      `USDC->${COLLATERAL}`,
      `USDC->${OPERATOR}`,
      `EURC->${COLLATERAL}`,
      `EURC->${OPERATOR}`,
    ]);
  });

  it('leaves out pairs already at a healthy allowance', () => {
    // Re-approving one is a transaction the cardholder pays for and gains
    // nothing from, and after a partially-landed batch it is the difference
    // between resuming and starting over.
    const pending = pendingApprovalsFor(
      chain({
        assets: [
          asset({
            spenders: [
              {
                kind: 'collateral',
                address: COLLATERAL,
                currentAllowance: UINT256_MAX,
                isApproved: true,
              },
              { kind: 'operator', address: OPERATOR, currentAllowance: '0', isApproved: false },
            ],
          }),
        ],
      }),
    );

    expect(pending).toHaveLength(1);
    expect(pending[0].spenderAddress).toBe(OPERATOR);
  });

  it('is empty for a chain with no assets, and for no chain at all', () => {
    expect(pendingApprovalsFor(chain({ assets: [] }))).toEqual([]);
    expect(pendingApprovalsFor(undefined)).toEqual([]);
  });
});

describe('buildApprovalBatch', () => {
  it('puts every outstanding approval on a chain into one batch', () => {
    // One user operation, four calls: same chain, same smart account, so the
    // cardholder signs once rather than four times.
    const batch = buildApprovalBatch({
      chain: chain({ assets: [asset(), asset({ symbol: 'EURC', tokenAddress: EURC })] }),
      maxAllowance: UINT256_MAX,
    });

    expect(batch).toHaveLength(4);
    expect(batch.map(call => call.to.toLowerCase())).toEqual([USDC, USDC, EURC, EURC]);
    expect(batch.map(call => decodeApprove(call.data).spender)).toEqual([
      COLLATERAL,
      OPERATOR,
      COLLATERAL,
      OPERATOR,
    ]);
  });

  it('sends each approval to its own token contract', () => {
    // `approve` is a method on the token, so the call target is the token and
    // the spender is the argument. Getting that backwards would approve the
    // spender contract as if it were an ERC-20 — a call that reverts at best
    // and silently does nothing at worst.
    const batch = buildApprovalBatch({
      chain: chain({ assets: [asset({ symbol: 'EURC', tokenAddress: EURC })] }),
      maxAllowance: UINT256_MAX,
    });

    expect(batch.every(call => call.to.toLowerCase() === EURC)).toBe(true);
  });

  it('asks for the full allowance the backend specified', () => {
    const batch = buildApprovalBatch({ chain: chain(), maxAllowance: UINT256_MAX });

    expect(batch.every(call => decodeApprove(call.data).amount === BigInt(UINT256_MAX))).toBe(true);
    // Never carries value: an ERC-20 approval moves no native token, and a
    // non-zero value here would be the cardholder's ETH, irrecoverably.
    expect(batch.every(call => call.value === 0n)).toBe(true);
  });

  it('is empty once everything is approved', () => {
    const approvedAsset = asset({
      spenders: [
        {
          kind: 'collateral',
          address: COLLATERAL,
          currentAllowance: UINT256_MAX,
          isApproved: true,
        },
        { kind: 'operator', address: OPERATOR, currentAllowance: UINT256_MAX, isApproved: true },
      ],
      isApproved: true,
    });

    expect(
      buildApprovalBatch({
        chain: chain({ assets: [approvedAsset] }),
        maxAllowance: UINT256_MAX,
      }),
    ).toEqual([]);
  });
});

describe('selectRtfChains', () => {
  it('lists every chain still owing approvals, in order', () => {
    const result = selectRtfChains(
      status({
        chains: [
          chain({ chainId: 8453, name: 'Base', assets: [], isApproved: true }),
          chain({ chainId: 84532 }),
          chain({ chainId: 42161, name: 'Arbitrum' }),
        ],
      }),
    );

    expect(result.chain?.chainId).toBe(84532);
    expect(result.pendingChains.map(entry => entry.chainId)).toEqual([84532, 42161]);
    expect(result.approvedChains.map(entry => entry.chainId)).toEqual([8453]);
  });

  it('never offers a chain with nothing to approve against', () => {
    // No collateral contract and the operator switched off. Offering it would
    // build an empty batch and record a consent for an authorization that
    // does not exist.
    const result = selectRtfChains(
      status({
        chains: [chain({ assets: [asset({ spenders: [] })], collateralAddress: null })],
      }),
    );

    expect(result.chain).toBeUndefined();
    expect(result.pendingChains).toEqual([]);
  });

  it('copes with a status that has not arrived', () => {
    expect(selectRtfChains(undefined)).toEqual({
      chain: undefined,
      pendingChains: [],
      approvedChains: [],
    });
  });
});

describe('describeApprovalWork', () => {
  it('counts allowances and signatures separately', () => {
    // The two differ and both are quoted to the cardholder. Four allowances
    // across two chains is two signatures, not four and not one — a screen
    // that conflated them would either understate the grant or spring a
    // second wallet prompt.
    const work = describeApprovalWork(
      status({
        chains: [
          chain({ chainId: 84532, name: 'Base Sepolia' }),
          chain({ chainId: 421614, name: 'Arbitrum Sepolia' }),
        ],
      }),
    );

    expect(work.approvals).toBe(4);
    expect(work.signatures).toBe(2);
    expect(work.chainNames).toEqual(['Base Sepolia', 'Arbitrum Sepolia']);
  });

  it('names every asset across every pending chain, deduplicated', () => {
    // The same asset on two chains is two allowances but one thing to name.
    // Listing only the first chain's assets would understate what is being
    // approved, and "USDC and USDC" would teach a cardholder nothing.
    const work = describeApprovalWork(
      status({
        chains: [
          chain({ chainId: 84532, name: 'Base Sepolia' }),
          chain({
            chainId: 421614,
            name: 'Arbitrum Sepolia',
            assets: [asset(), asset({ symbol: 'EURC', tokenAddress: EURC })],
          }),
        ],
      }),
    );

    expect(work.assetSymbols).toEqual(['USDC', 'EURC']);
  });

  it('counts one signature for many approvals on a single chain', () => {
    // The thing batching actually buys. Everything on one chain is one user
    // operation however many assets and spenders it covers.
    const work = describeApprovalWork(
      status({
        chains: [chain({ assets: [asset(), asset({ symbol: 'EURC', tokenAddress: EURC })] })],
      }),
    );

    expect(work.approvals).toBe(4);
    expect(work.signatures).toBe(1);
    expect(work.assetSymbols).toEqual(['USDC', 'EURC']);
  });

  it('leaves out chains that are already done', () => {
    const work = describeApprovalWork(
      status({
        chains: [
          chain({ chainId: 8453, name: 'Base', assets: [], isApproved: true }),
          chain({ chainId: 84532, name: 'Base Sepolia' }),
        ],
      }),
    );

    expect(work.signatures).toBe(1);
    expect(work.chainNames).toEqual(['Base Sepolia']);
  });

  it('is zero work when there is nothing to do', () => {
    expect(describeApprovalWork(undefined)).toEqual({
      approvals: 0,
      signatures: 0,
      chainNames: [],
      assetSymbols: [],
    });
  });
});

describe('shouldOfferRtf', () => {
  it('offers the row when every condition holds', () => {
    expect(shouldOfferRtf({ isRainCard: true, status: status() })).toBe(true);
  });

  it('never offers it on a non-Rain card', () => {
    // RTF is a Rain feature: a Wirex cardholder has no Rain collateral
    // contract to pull into, so there is nothing an approval would do.
    expect(shouldOfferRtf({ isRainCard: false, status: status() })).toBe(false);
  });

  it('never offers it while the tenant is not enabled', () => {
    // Offering before Rain has enabled the tenant means a cardholder grants
    // an unlimited allowance and is told their card draws from their wallet,
    // which it does not.
    expect(shouldOfferRtf({ isRainCard: true, status: status({ tenantEnabled: false }) })).toBe(
      false,
    );
  });

  it('never offers it to an ineligible account', () => {
    expect(
      shouldOfferRtf({
        isRainCard: true,
        status: status({ eligible: false, ineligibleReason: 'no-wallet' }),
      }),
    ).toBe(false);
  });

  it('stops offering it once every approval lands', () => {
    // The row is a task, not a setting. This is what makes it disappear.
    const approvedAsset = asset({
      spenders: [
        {
          kind: 'collateral',
          address: COLLATERAL,
          currentAllowance: UINT256_MAX,
          isApproved: true,
        },
        { kind: 'operator', address: OPERATOR, currentAllowance: UINT256_MAX, isApproved: true },
      ],
      isApproved: true,
    });

    expect(
      shouldOfferRtf({
        isRainCard: true,
        status: status({ chains: [chain({ assets: [approvedAsset] })] }),
      }),
    ).toBe(false);
  });

  it('keeps offering it while one asset of several is unapproved', () => {
    // A card fully approved for USDC still declines any authorization that
    // would pull EURC, so the row has to stay up for the asset that is left.
    const approvedUsdc = asset({
      spenders: [
        {
          kind: 'collateral',
          address: COLLATERAL,
          currentAllowance: UINT256_MAX,
          isApproved: true,
        },
        { kind: 'operator', address: OPERATOR, currentAllowance: UINT256_MAX, isApproved: true },
      ],
      isApproved: true,
    });

    expect(
      shouldOfferRtf({
        isRainCard: true,
        status: status({
          chains: [
            chain({ assets: [approvedUsdc, asset({ symbol: 'EURC', tokenAddress: EURC })] }),
          ],
        }),
      }),
    ).toBe(true);
  });

  it('keeps offering it while a chain is unreadable', () => {
    // An RPC outage must not hide the feature. A redundant approval is a
    // cheap transaction; a hidden one is a card that declines with no way to
    // fix it from the app.
    expect(
      shouldOfferRtf({
        isRainCard: true,
        status: status({
          chains: [
            chain({
              unavailableReason: 'Could not read chain 84532',
              assets: [
                asset({
                  walletBalance: null,
                  spenders: [
                    {
                      kind: 'collateral',
                      address: COLLATERAL,
                      currentAllowance: null,
                      isApproved: false,
                    },
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
    ).toBe(true);
  });

  it('does not offer it before the status has arrived', () => {
    expect(shouldOfferRtf({ isRainCard: true, status: undefined })).toBe(false);
  });
});
