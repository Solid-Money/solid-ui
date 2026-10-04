import { formatTokenAmount, selectRtfChains, shouldOfferRtf } from '@/lib/utils/realTimeFunding';

import type { RainRtfChain, RainRtfStatus } from '@/lib/types';

const UINT256_MAX = (2n ** 256n - 1n).toString();

const chain = (overrides: Partial<RainRtfChain> = {}): RainRtfChain => ({
  chainId: 84532,
  name: 'Base Sepolia',
  environment: 'sandbox',
  assetSymbol: 'USDC',
  tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
  tokenDecimals: 6,
  collateralAddress: '0x2222222222222222222222222222222222222222',
  spenders: [
    {
      kind: 'collateral',
      address: '0x2222222222222222222222222222222222222222',
      currentAllowance: '0',
      isApproved: false,
    },
  ],
  walletAddress: '0x1111111111111111111111111111111111111111',
  walletBalance: '0',
  isApproved: false,
  hasConsent: false,
  consentAt: null,
  transactionHash: null,
  unavailableReason: null,
  ...overrides,
});

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
  legacyRevokeAvailable: false,
  chains: [chain()],
  ...overrides,
});

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

describe('selectRtfChains', () => {
  it('picks the first chain still waiting on an approval', () => {
    const result = selectRtfChains(
      status({
        chains: [
          chain({ chainId: 8453, name: 'Base', isApproved: true }),
          chain({ chainId: 84532 }),
        ],
      }),
    );

    expect(result.chain?.chainId).toBe(84532);
    expect(result.approvedChains.map(entry => entry.chainId)).toEqual([8453]);
  });

  it('never offers a chain with no spenders to approve', () => {
    // Nothing to approve against — Rain provisioned no collateral contract and
    // the operator is switched off. Offering it would build an empty batch and
    // record a consent for an authorization that does not exist.
    const result = selectRtfChains(
      status({
        chains: [chain({ spenders: [], collateralAddress: null })],
      }),
    );

    expect(result.chain).toBeUndefined();
  });

  it('has nothing to offer once every chain is approved', () => {
    const result = selectRtfChains(status({ chains: [chain({ isApproved: true })] }));

    expect(result.chain).toBeUndefined();
    expect(result.approvedChains).toHaveLength(1);
  });

  it('copes with a status that has not arrived', () => {
    expect(selectRtfChains(undefined)).toEqual({
      chain: undefined,
      approvedChains: [],
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

  it('stops offering it once the approval lands', () => {
    // The row is a task, not a setting. This is what makes it disappear.
    expect(
      shouldOfferRtf({
        isRainCard: true,
        status: status({ chains: [chain({ isApproved: true })] }),
      }),
    ).toBe(false);
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
              spenders: [
                {
                  kind: 'collateral',
                  address: '0x2222222222222222222222222222222222222222',
                  currentAllowance: null,
                  isApproved: false,
                },
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
