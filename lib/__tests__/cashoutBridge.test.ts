import { parseUnits } from 'viem';

import { bridgeCap, bridgeShortfall, BridgePlanError, planBridge } from '@/lib/cashoutBridge';

import type { CrossChainSendQuote } from '@/lib/types/cross-chain-send';

jest.mock('@/lib/utils/cross-chain-send', () => ({
  formatLD: (amountLD: string) => jest.requireActual('viem').formatUnits(BigInt(amountLD), 6),
}));

const usdc = (amount: string) => parseUnits(amount, 6);

/** A bridge that keeps a flat 0.40 USDC plus 0.06% of what it's sent. */
const feeQuote = jest.fn(async (amountLD: bigint): Promise<CrossChainSendQuote> => {
  const fee = usdc('0.4') + (amountLD * 6n) / 10_000n;
  return {
    amountLD: amountLD.toString(),
    amountReceivedLD: (amountLD - fee).toString(),
    totalFeeLD: fee.toString(),
  } as CrossChainSendQuote;
});

const CAP = { amountLD: usdc('1250'), reason: 'balance' as const };

beforeEach(() => feeQuote.mockClear());

describe('bridgeShortfall', () => {
  it('is what the Base balance doesn’t cover, and nothing when it does', () => {
    expect(bridgeShortfall(usdc('200'), usdc('12.4'))).toBe(usdc('187.6'));
    expect(bridgeShortfall(usdc('10'), usdc('12.4'))).toBe(0n);
    expect(bridgeShortfall(undefined, usdc('12.4'))).toBe(0n);
  });
});

describe('bridgeCap', () => {
  it('takes the lowest bound, and the balance on a tie', () => {
    expect(
      bridgeCap({
        balance: usdc('50'),
        per_send: usdc('10000'),
        daily: usdc('50'),
        route: usdc('9000000'),
      }),
    ).toEqual({ amountLD: usdc('50'), reason: 'balance' });
    expect(
      bridgeCap({
        balance: usdc('900'),
        per_send: usdc('10000'),
        daily: usdc('300'),
        route: usdc('9000000'),
      }),
    ).toEqual({ amountLD: usdc('300'), reason: 'daily' });
  });
});

describe('planBridge', () => {
  it('moves enough that what lands covers the shortfall, fees included', async () => {
    const shortfallLD = usdc('187.6');
    const plan = await planBridge({ shortfallLD, minLD: usdc('5'), cap: CAP, quote: feeQuote });
    expect(BigInt(plan.amountReceivedLD)).toBeGreaterThanOrEqual(shortfallLD);
    // No more than a few units over: the fee is added back, not guessed at.
    expect(BigInt(plan.amountReceivedLD) - shortfallLD).toBeLessThan(1000n);
    expect(feeQuote.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('moves the bridge minimum for a shortfall below it', async () => {
    const plan = await planBridge({
      shortfallLD: usdc('1'),
      minLD: usdc('5'),
      cap: CAP,
      quote: feeQuote,
    });
    expect(feeQuote).toHaveBeenCalledTimes(1);
    expect(plan.amountLD).toBe(usdc('5').toString());
  });

  it('refuses a shortfall the cap can’t cover once fees are added', async () => {
    const cap = { amountLD: usdc('100'), reason: 'balance' as const };
    await expect(
      planBridge({ shortfallLD: usdc('99.9'), minLD: usdc('5'), cap, quote: feeQuote }),
    ).rejects.toThrow('That’s more than your balance once the bridge fee is included');
  });

  it('names the per-send limit when that is the cap', async () => {
    const cap = { amountLD: usdc('10000'), reason: 'per_send' as const };
    await expect(
      planBridge({ shortfallLD: usdc('12000'), minLD: usdc('5'), cap, quote: feeQuote }),
    ).rejects.toThrow('You can move up to 10000 USDC from Fuse per cash-out');
    expect(feeQuote).not.toHaveBeenCalled();
  });

  it('covers what Max filled: all that moving the whole cap would land', async () => {
    const landed = BigInt((await feeQuote(CAP.amountLD)).amountReceivedLD);
    feeQuote.mockClear();
    const plan = await planBridge({
      shortfallLD: landed,
      minLD: usdc('5'),
      cap: CAP,
      quote: feeQuote,
    });
    expect(BigInt(plan.amountReceivedLD)).toBeGreaterThanOrEqual(landed);
    expect(BigInt(plan.amountLD)).toBeLessThanOrEqual(CAP.amountLD);
  });

  it('is a BridgePlanError when the cap can’t cover it', async () => {
    const cap = { amountLD: usdc('3'), reason: 'route' as const };
    await expect(
      planBridge({ shortfallLD: usdc('1'), minLD: usdc('5'), cap, quote: feeQuote }),
    ).rejects.toBeInstanceOf(BridgePlanError);
  });
});
