import { parseUnits, zeroAddress } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';

import {
  arrivedFundingCoverUsd,
  billingTokenRow,
  canPayCashWith,
  cashFundingTokens,
  defaultCashToken,
  estimateFundingCoverUsd,
  FUNDING_PRICE_BUFFER,
  fundingNeedUsd,
  fundingSendAmount,
  latestUpgradeFunding,
} from '@/lib/tierUpgradeFunding';
import { TokenBalance, TokenType } from '@/lib/types';

import type { TrackedLifiSwap } from '@/store/lifiSwapStore';

const BILLING = '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const row = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: BASE_USDC,
  balance: parseUnits('250', 6).toString(),
  contractDecimals: 6,
  quoteRate: 1,
  type: TokenType.ERC20,
  chainId: base.id,
  ...overrides,
});

const usdcOnFuse = (dollars: number) =>
  billingTokenRow({ address: BILLING, balanceRaw: parseUnits(String(dollars), 6) });

const swap = (overrides: Partial<TrackedLifiSwap>): TrackedLifiSwap => ({
  clientTxId: 'c1',
  userId: 'user-1',
  txHash: '0xhash',
  fromChainId: base.id,
  toChainId: fuse.id,
  fromSymbol: 'USDC',
  toSymbol: 'USDC',
  fromAmount: '199.995',
  toAmount: '197.40',
  etaSeconds: 20,
  submittedAt: 1_000,
  status: 'PENDING',
  purpose: 'tier_upgrade',
  fromAmountUsd: '199.00',
  ...overrides,
});

describe('cashFundingTokens', () => {
  const billing = usdcOnFuse(10);

  it('lists USDC on Fuse first, then holdings on other swap chains', () => {
    const rows = cashFundingTokens({
      tokens: [
        row({}),
        row({
          chainId: mainnet.id,
          contractAddress: zeroAddress,
          contractTickerSymbol: 'ETH',
          contractDecimals: 18,
          balance: parseUnits('0.1', 18).toString(),
          quoteRate: 2500,
          type: TokenType.NATIVE,
        }),
      ],
      billing,
      lifiChainIds: [base.id, mainnet.id],
    });

    expect(rows.map(token => `${token.contractTickerSymbol}@${token.chainId}`)).toEqual([
      `USDC@${fuse.id}`,
      `USDC@${base.id}`,
      `ETH@${mainnet.id}`,
    ]);
  });

  it('leaves out Fuse tokens, savings shares and dust', () => {
    const rows = cashFundingTokens({
      tokens: [
        row({ chainId: fuse.id }),
        row({ contractTickerSymbol: 'soUSD' }),
        row({ balance: parseUnits('0.5', 6).toString() }),
        row({ quoteRate: 0 }),
      ],
      billing,
      lifiChainIds: [base.id, fuse.id],
    });

    expect(rows).toEqual([billing]);
  });
});

describe('fundingSendAmount', () => {
  it('sends the shortfall plus the buffer, in the token', () => {
    const amount = fundingSendAmount({ usd: 199, token: row({}) })!;
    const buffered = parseUnits((199 * (1 + FUNDING_PRICE_BUFFER)).toFixed(6), 6);
    // Rounded up, never down: a micro-unit over is fine, a micro-unit under
    // is a transfer the backend values at a cent short.
    expect(amount >= buffered - 1n).toBe(true);
    expect(amount <= buffered + 1n).toBe(true);
    expect(amount > parseUnits('199', 6)).toBe(true);
  });

  it("prices at LI.FI's rate once a quote has named one", () => {
    const eth = row({
      contractAddress: zeroAddress,
      contractTickerSymbol: 'ETH',
      contractDecimals: 18,
      balance: parseUnits('1', 18).toString(),
      quoteRate: 2000,
      type: TokenType.NATIVE,
    });
    const atWallet = fundingSendAmount({ usd: 200, token: eth })!;
    const atLifi = fundingSendAmount({ usd: 200, token: eth, priceUsd: 2500 })!;
    expect(atLifi < atWallet).toBe(true);
  });

  it('never sends more than the user holds', () => {
    const small = row({ balance: parseUnits('150', 6).toString() });
    expect(fundingSendAmount({ usd: 199, token: small })).toBe(parseUnits('150', 6));
  });

  it('sends nothing for an unpriced token', () => {
    expect(fundingSendAmount({ usd: 199, token: row({ quoteRate: 0 }) })).toBeUndefined();
  });
});

describe('estimateFundingCoverUsd', () => {
  it('covers what the transfer lost when that is what is missing', () => {
    expect(
      estimateFundingCoverUsd({
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverPct: 5,
        sentUsd: 199,
        receivedUsd: 197.4,
      }),
    ).toBeCloseTo(1.6, 6);
  });

  it('never covers what was not sent', () => {
    // $150 sent, $148.80 landed: $1.20 of fees is covered, not the $50.20 gap.
    expect(
      estimateFundingCoverUsd({
        feeUsd: 199,
        fuseUsdc: 148.8,
        coverPct: 5,
        sentUsd: 150,
        receivedUsd: 148.8,
      }),
    ).toBeCloseTo(1.2, 6);
  });

  it('is capped at the allowance', () => {
    expect(
      estimateFundingCoverUsd({
        feeUsd: 199,
        fuseUsdc: 180,
        coverPct: 5,
        sentUsd: 199,
        receivedUsd: 180,
      }),
    ).toBeCloseTo(9.95, 6);
  });

  it('is nothing while the allowance is off', () => {
    expect(
      estimateFundingCoverUsd({
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverPct: 0,
        sentUsd: 199,
        receivedUsd: 197.4,
      }),
    ).toBe(0);
  });
});

describe('canPayCashWith', () => {
  it('pays from USDC on Fuse once an arrived payment is counted with its cover', () => {
    const token = usdcOnFuse(197.4);
    expect(
      canPayCashWith({
        token,
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverUsd: 0,
      }),
    ).toBe(false);
    expect(
      canPayCashWith({
        token,
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverUsd: 1.6,
      }),
    ).toBe(true);
  });

  it('pays from another chain when the holding is worth what is missing', () => {
    expect(
      canPayCashWith({
        token: row({ balance: parseUnits('150', 6).toString() }),
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 50,
        coverUsd: 0,
      }),
    ).toBe(true);
    expect(
      canPayCashWith({
        token: row({ balance: parseUnits('100', 6).toString() }),
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 50,
        coverUsd: 0,
      }),
    ).toBe(false);
  });
});

describe('defaultCashToken', () => {
  const rows = [
    usdcOnFuse(0),
    row({}),
    row({ chainId: mainnet.id, balance: parseUnits('500', 6).toString() }),
  ];

  it('opens on the richest holding that covers the fee when Fuse is short', () => {
    const token = defaultCashToken({
      rows,
      billingTokenAddress: BILLING,
      feeUsd: 199,
      fuseUsdc: 0,
      funding: { state: 'none' },
    });
    expect(token?.chainId).toBe(mainnet.id);
  });

  it('stays on USDC on Fuse when it already covers the fee', () => {
    const token = defaultCashToken({
      rows,
      billingTokenAddress: BILLING,
      feeUsd: 199,
      fuseUsdc: 205,
      funding: { state: 'none' },
    });
    expect(token?.chainId).toBe(fuse.id);
  });

  it('stays on USDC on Fuse while a bridged payment is on its way', () => {
    const token = defaultCashToken({
      rows,
      billingTokenAddress: BILLING,
      feeUsd: 199,
      fuseUsdc: 0,
      funding: { state: 'pending', swap: swap({}) },
    });
    expect(token?.chainId).toBe(fuse.id);
  });
});

describe('latestUpgradeFunding', () => {
  it('follows the newest unspent upgrade payment for this user', () => {
    const swaps = {
      old: swap({ clientTxId: 'old', submittedAt: 1, status: 'DONE', substatus: 'COMPLETED' }),
      new: swap({ clientTxId: 'new', submittedAt: 2 }),
      other: swap({ clientTxId: 'other', submittedAt: 3, userId: 'user-2' }),
      plain: swap({ clientTxId: 'plain', submittedAt: 4, purpose: undefined }),
    };
    const funding = latestUpgradeFunding(swaps, 'user-1');
    expect(funding.state).toBe('pending');
    expect(funding.state !== 'none' && funding.swap.clientTxId).toBe('new');
  });

  it('counts only a completed delivery as arrived', () => {
    expect(
      latestUpgradeFunding({ a: swap({ status: 'DONE', substatus: 'COMPLETED' }) }, 'user-1').state,
    ).toBe('arrived');
    expect(
      latestUpgradeFunding({ a: swap({ status: 'DONE', substatus: 'REFUNDED' }) }, 'user-1').state,
    ).toBe('failed');
    expect(
      latestUpgradeFunding({ a: swap({ status: 'DONE', substatus: 'PARTIAL' }) }, 'user-1').state,
    ).toBe('failed');
  });

  it('forgets a payment a membership has already used', () => {
    expect(
      latestUpgradeFunding(
        { a: swap({ status: 'DONE', substatus: 'COMPLETED', consumed: true }) },
        'user-1',
      ).state,
    ).toBe('none');
  });
});

describe('arrivedFundingCoverUsd', () => {
  it('reads the cover off what was quoted and what landed', () => {
    expect(
      arrivedFundingCoverUsd({
        funding: {
          state: 'arrived',
          swap: swap({ status: 'DONE', substatus: 'COMPLETED' }),
        },
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverPct: 5,
      }),
    ).toBeCloseTo(1.6, 6);
  });

  it('is nothing until the payment has landed', () => {
    expect(
      arrivedFundingCoverUsd({
        funding: { state: 'pending', swap: swap({}) },
        feeUsd: 199,
        fuseUsdc: 0,
        coverPct: 5,
      }),
    ).toBe(0);
  });
});

describe('fundingNeedUsd', () => {
  it('is what Fuse is still missing, never negative', () => {
    expect(fundingNeedUsd(199, 50)).toBe(149);
    expect(fundingNeedUsd(199, 250)).toBe(0);
  });
});
