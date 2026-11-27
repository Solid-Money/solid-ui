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
  fundingNativeShortfall,
  fundingNeedUsd,
  fundingSendAmount,
  fundingSendUsd,
  latestUpgradeFunding,
  resolveCashPayment,
  UNCOVERED_FUNDING_HEADROOM,
} from '@/lib/tierUpgradeFunding';
import { TokenBalance, TokenType } from '@/lib/types';

import type { TrackedLifiSwap } from '@/store/lifiSwapStore';

// Reached through the card's asset table (soBTC), and never called here. The
// real module loads wagmi's ESM build, which this jest setup cannot parse.
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

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
        coverPct: 1,
      }),
    ).toBe(false);
    expect(
      canPayCashWith({
        token,
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 197.4,
        coverUsd: 1.6,
        coverPct: 1,
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
        coverPct: 1,
      }),
    ).toBe(true);
    expect(
      canPayCashWith({
        token: row({ balance: parseUnits('100', 6).toString() }),
        billingTokenAddress: BILLING,
        feeUsd: 199,
        fuseUsdc: 50,
        coverUsd: 0,
        coverPct: 1,
      }),
    ).toBe(false);
  });
});

describe('canPayCashWith, with nothing to cover the bridge', () => {
  /**
   * A `transfer` upgrade sends the shortfall and its headroom: $19 short is
   * $19.38 sent. A holding between the two would be quoted capped at the
   * balance and land short, so it is not offered as able to pay.
   */
  it('wants the amount sent, not just the shortfall', () => {
    const pay = (dollars: string) =>
      canPayCashWith({
        token: row({ balance: parseUnits(dollars, 6).toString() }),
        billingTokenAddress: BILLING,
        feeUsd: 799,
        fuseUsdc: 780,
        coverUsd: 0,
        coverPct: 0,
      });
    expect(pay('19.10')).toBe(false);
    expect(pay('19.38')).toBe(true);
  });

  it('opens on a holding only when it covers the amount sent', () => {
    const token = defaultCashToken({
      rows: [usdcOnFuse(780), row({ balance: parseUnits('19.10', 6).toString() })],
      billingTokenAddress: BILLING,
      feeUsd: 799,
      fuseUsdc: 780,
      funding: { state: 'none' },
      coverPct: 0,
    });
    expect(token?.chainId).toBe(fuse.id);
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
      coverPct: 1,
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
      coverPct: 1,
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
      coverPct: 1,
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

describe('resolveCashPayment', () => {
  const baseUsdc = row({});
  const BASE_KEY = { chainId: base.id, address: BASE_USDC };
  const arrived = {
    state: 'arrived' as const,
    swap: swap({ status: 'DONE', substatus: 'COMPLETED', settledAt: 1_500 }),
  };

  /** Ultra by transfer: $799 now, and nothing covers what a bridge takes. */
  const resolve = (overrides: Partial<Parameters<typeof resolveCashPayment>[0]> = {}) => {
    const fuseUsdc = overrides.fuseUsdc ?? 0;
    return resolveCashPayment({
      tokens: [usdcOnFuse(fuseUsdc), baseUsdc],
      chosen: null,
      billingTokenAddress: BILLING,
      feeUsd: 799,
      fuseUsdc,
      coverPct: 0,
      funding: { state: 'none' },
      balancesLoaded: true,
      // After `arrived` settled: the balance in hand can include it.
      usdcReadAt: 2_000,
      paymentMode: 'transfer',
      awaitingConfirm: false,
      ...overrides,
    });
  };

  /**
   * A bridged payment for a transfer upgrade landed $19 short. Nothing will
   * cover it, so waiting gets nowhere: the rest has to be sent, and only the
   * rest.
   */
  describe('a bridged payment that left a transfer upgrade short', () => {
    it('lets the rest be sent from another chain, sized to what is missing', () => {
      const payment = resolve({ fuseUsdc: 780, funding: arrived, chosen: BASE_KEY });

      expect(payment.arrivedShortUsd).toBeCloseTo(19, 6);
      expect(payment.token?.chainId).toBe(base.id);
      expect(payment.payingFromFuse).toBe(false);
      expect(payment.needUsd).toBeCloseTo(19, 6);
      expect(payment.sendUsd).toBeCloseTo(19 * (1 + UNCOVERED_FUNDING_HEADROOM), 6);
      // The token can pay the rest; the USDC on Fuse cannot pay the fee yet.
      expect(payment.affordable).toBe(true);
      expect(payment.fuseCoversFee).toBe(false);
    });

    it('opens on a holding that can send the rest', () => {
      expect(resolve({ fuseUsdc: 780, funding: arrived }).token?.chainId).toBe(base.id);
    });

    it('keeps USDC on Fuse once the rest has landed', () => {
      const payment = resolve({ fuseUsdc: 800, funding: arrived, chosen: BASE_KEY });

      expect(payment.arrivedShortUsd).toBe(0);
      expect(payment.token?.chainId).toBe(fuse.id);
      expect(payment.affordable).toBe(true);
      expect(payment.fuseCoversFee).toBe(true);
    });

    /**
     * The bridge has landed, and the balance in hand is from a read asked for
     * before the app knew — it can have come back after, and still not have the
     * USDC in it. Read off that, the whole $799 looks missing, and a second
     * $814.98 bridge would be offered for USDC that is already there.
     */
    describe('before a balance read asked for after it landed', () => {
      it('keeps the arrived payment standing in, and offers nothing to send', () => {
        const payment = resolve({
          fuseUsdc: 0,
          funding: arrived,
          chosen: BASE_KEY,
          usdcReadAt: 1_400,
        });

        expect(payment.checkingArrivedBalance).toBe(true);
        expect(payment.arrivedShortUsd).toBe(0);
        // The Base pick is not honoured, so there is no quote to open.
        expect(payment.token?.chainId).toBe(fuse.id);
        expect(payment.payingFromFuse).toBe(true);
        expect(payment.affordable).toBe(false);
      });

      it('does not open on another chain either', () => {
        expect(resolve({ fuseUsdc: 0, funding: arrived, usdcReadAt: 1_400 }).token?.chainId).toBe(
          fuse.id,
        );
      });

      it('waits while there is no balance at all', () => {
        const payment = resolve({
          fuseUsdc: 0,
          funding: arrived,
          balancesLoaded: false,
          usdcReadAt: undefined,
        });

        expect(payment.checkingArrivedBalance).toBe(true);
        expect(payment.arrivedShortUsd).toBe(0);
      });

      it('says how short it is once a read asked for after it comes back', () => {
        const payment = resolve({ fuseUsdc: 780, funding: arrived, usdcReadAt: 1_501 });

        expect(payment.checkingArrivedBalance).toBe(false);
        expect(payment.arrivedShortUsd).toBeCloseTo(19, 6);
      });

      /** Settled before `settledAt` was kept, so before any read this session took. */
      it('takes any read for a payment settled with no time on it', () => {
        const payment = resolve({
          fuseUsdc: 780,
          funding: { state: 'arrived', swap: swap({ status: 'DONE', substatus: 'COMPLETED' }) },
          usdcReadAt: 1,
        });

        expect(payment.checkingArrivedBalance).toBe(false);
        expect(payment.arrivedShortUsd).toBeCloseTo(19, 6);
      });

      it('has nothing to wait for with no payment arrived', () => {
        expect(resolve({ usdcReadAt: undefined }).checkingArrivedBalance).toBe(false);
      });
    });

    /** A module subscription's arrived payment is still judged with its cover. */
    it('changes nothing for a module subscription', () => {
      const payment = resolve({
        fuseUsdc: 780,
        funding: arrived,
        chosen: BASE_KEY,
        paymentMode: 'module',
        coverPct: 5,
      });

      expect(payment.arrivedShortUsd).toBe(0);
      expect(payment.token?.chainId).toBe(fuse.id);
    });
  });

  /**
   * An upgrade paid by transfer and not yet confirmed has already taken the
   * USDC. The gap on Fuse is that payment: nothing more is to be sent for it.
   */
  describe('while an earlier payment awaits confirmation', () => {
    it('does not read the gap as a shortfall to send', () => {
      const payment = resolve({
        fuseUsdc: 0,
        funding: arrived,
        chosen: BASE_KEY,
        awaitingConfirm: true,
      });

      expect(payment.arrivedShortUsd).toBe(0);
      expect(payment.token?.chainId).toBe(fuse.id);
      expect(payment.payingFromFuse).toBe(true);
      expect(payment.affordable).toBe(false);
    });

    it('stays on USDC on Fuse with no bridged payment either', () => {
      expect(resolve({ chosen: BASE_KEY, awaitingConfirm: true }).token?.chainId).toBe(fuse.id);
      expect(resolve({ chosen: BASE_KEY, awaitingConfirm: false }).token?.chainId).toBe(base.id);
    });
  });
});

describe('fundingSendUsd', () => {
  /** The cover absorbs what the bridge takes, so the shortfall is what is sent. */
  it('sends the shortfall when the bridge is covered', () => {
    expect(fundingSendUsd(149, 5)).toBe(149);
  });

  /**
   * A transfer upgrade has no cover: the fee has to arrive in full, and a
   * payment sized to the shortfall lands a bridge fee short of it every time.
   */
  it('sends headroom when nothing covers the bridge', () => {
    expect(fundingSendUsd(799, 0)).toBeCloseTo(799 * (1 + UNCOVERED_FUNDING_HEADROOM), 6);
    expect(fundingSendUsd(799, 0)).toBeGreaterThan(799);
  });

  it('sends nothing for nothing missing', () => {
    expect(fundingSendUsd(0, 0)).toBe(0);
  });
});

describe('fundingNativeShortfall', () => {
  /** 0.000732 ETH, the Stargate fee on a Base USDC payment for Ultra. */
  const FEE = 732_000_000_000_000n;
  const quote = (value: string, sponsored = false) => ({
    transactionRequest: {
      to: zeroAddress,
      data: '0x' as const,
      value,
      chainId: base.id,
    },
    ...(sponsored
      ? {
          sponsorship: {
            paymaster: zeroAddress,
            wrapNative: false,
            voucher: {
              from: zeroAddress,
              target: zeroAddress,
              token: BASE_USDC,
              amount: '699000000',
              dataHash: '0x',
              nativeFee: FEE.toString(),
              nonce: '1',
              deadline: '1',
            },
            signature: '0x' as const,
          },
        }
      : {}),
  });

  /**
   * Base USDC into Fuse USDC goes over Stargate, whose fee the Base paymaster
   * pays: a Safe holding no ETH can still pay. Nov 27 2026, three Prime/Ultra
   * buyers were told to hold ETH on Base for a fee they would never be charged.
   */
  it('asks for nothing when the paymaster pays the bridge fee', () => {
    expect(fundingNativeShortfall({ quote: quote(FEE.toString(), true), nativeBalance: 0n })).toBe(
      undefined,
    );
  });

  it('asks for the fee an unsponsored route charges on top, when the Safe lacks it', () => {
    expect(fundingNativeShortfall({ quote: quote(FEE.toString()), nativeBalance: FEE - 1n })).toBe(
      FEE,
    );
  });

  it('asks for nothing when the Safe holds the fee', () => {
    expect(fundingNativeShortfall({ quote: quote(FEE.toString()), nativeBalance: FEE })).toBe(
      undefined,
    );
  });

  it('asks for nothing on a route with no native value, or before a quote', () => {
    expect(fundingNativeShortfall({ quote: quote('0'), nativeBalance: 0n })).toBe(undefined);
    expect(fundingNativeShortfall({ quote: quote(''), nativeBalance: 0n })).toBe(undefined);
    expect(fundingNativeShortfall({ quote: undefined, nativeBalance: 0n })).toBe(undefined);
  });
});
