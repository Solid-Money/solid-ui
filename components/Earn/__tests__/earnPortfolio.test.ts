import { fuse } from 'viem/chains';

import {
  calculateEstimatedDailyEarnings,
  FALLBACK_VAULT_APY,
  formatVaultApyLabel,
  interestOverPastDays,
  isYieldShare,
  resolveVaultApy,
  type UsdVaultAmounts,
  type VaultApys,
  weightedApy,
  yieldHoldings,
} from '@/components/Earn/earnPortfolio';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { VaultType } from '@/lib/types';

describe('calculateEstimatedDailyEarnings', () => {
  it('weights each vault APY by its USD value', () => {
    const values: UsdVaultAmounts = {
      [VaultType.USDC]: 1_000,
      [VaultType.ETH]: 2_000,
      [VaultType.FUSE]: 500,
    };
    const apys: VaultApys = {
      [VaultType.USDC]: 3.65,
      [VaultType.ETH]: 7.3,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: undefined,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBeCloseTo(0.5, 8);
  });

  it('does not allow invalid negative balances or APYs to reduce the estimate', () => {
    const values: UsdVaultAmounts = {
      [VaultType.USDC]: -1_000,
      [VaultType.ETH]: 1_000,
      [VaultType.FUSE]: 0,
    };
    const apys: VaultApys = {
      [VaultType.USDC]: 10,
      [VaultType.ETH]: -5,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: undefined,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBe(0);
  });

  // soEURC is held in EUR: even with a rate, a euro balance never enters "+$… today".
  it('never adds the EUR vault into the dollar estimate', () => {
    const values: UsdVaultAmounts = { [VaultType.EUR]: 36_500 };
    const apys: VaultApys = {
      [VaultType.USDC]: 0,
      [VaultType.ETH]: 0,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: 10,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBe(0);
  });
});

describe('resolveVaultApy', () => {
  it('prefers the reported APY when the analytics API returns one', () => {
    expect(resolveVaultApy(VaultType.USDC, 5.2)).toBe(5.2);
    expect(resolveVaultApy(VaultType.EUR, 1.5)).toBe(1.5);
  });

  it.each([
    [VaultType.USDC, 4],
    [VaultType.ETH, 2],
    [VaultType.FUSE, 14],
  ])('falls back to the indicative rate for %s', (vaultType, expected) => {
    expect(resolveVaultApy(vaultType, 0)).toBe(expected);
    expect(resolveVaultApy(vaultType, undefined)).toBe(expected);
  });

  // The EUR vault is 0% for now: its tile reads 0%, never another vault's indicative rate.
  it('falls back to 0% for the EUR vault', () => {
    expect(FALLBACK_VAULT_APY[VaultType.EUR]).toBe(0);
    expect(resolveVaultApy(VaultType.EUR, 0)).toBe(0);
    expect(resolveVaultApy(VaultType.EUR, undefined)).toBe(0);
  });

  it('falls back rather than showing a negative APY', () => {
    expect(resolveVaultApy(VaultType.ETH, -0.8)).toBe(FALLBACK_VAULT_APY[VaultType.ETH]);
  });
});

describe('formatVaultApyLabel', () => {
  it('renders one decimal place, matching the vault tile design', () => {
    expect(formatVaultApyLabel(4.5)).toBe('4.5% APY');
    expect(formatVaultApyLabel(4)).toBe('4.0% APY');
  });

  it('shows two decimals under 1%, so a small rate is not "0.0%"', () => {
    expect(formatVaultApyLabel(0.0365)).toBe('0.04% APY');
    expect(formatVaultApyLabel(0.95)).toBe('0.95% APY');
    expect(formatVaultApyLabel(0)).toBe('0.0% APY');
  });

  it('shows a dash, not 0%, for a vault with no rate', () => {
    expect(formatVaultApyLabel(undefined)).toBe('— APY');
  });
});

describe('interestOverPastDays', () => {
  it('reads 30 days of share-price growth back out of the 30-day APY', () => {
    // $2,560 at 4.5% a year: about $9.24 over 30 days.
    expect(interestOverPastDays(2560, 4.5)).toBeCloseTo(9.24, 2);
    expect(interestOverPastDays(27, 4.5)).toBeCloseTo(0.098, 2);
  });

  it('never claims more than was earned since the first deposit', () => {
    // Deposited a week ago: only a week of interest exists.
    expect(interestOverPastDays(2560, 4.5, 30, 2.1)).toBe(2.1);
    expect(interestOverPastDays(2560, 4.5, 30, 0)).toBe(0);
  });

  it('is zero without a balance or a rate', () => {
    expect(interestOverPastDays(0, 4.5)).toBe(0);
    expect(interestOverPastDays(2560, undefined)).toBe(0);
    expect(interestOverPastDays(2560, 0)).toBe(0);
    expect(interestOverPastDays(2560, Number.NaN)).toBe(0);
  });
});

describe('yieldHoldings', () => {
  const earnAssets = [
    { vault: { type: VaultType.USDC }, valueUsd: 2560, shareAmount: 2363.8, apy: 4.5 },
    { vault: { type: VaultType.ETH }, valueUsd: 310, shareAmount: 0.0752, apy: 2.9 },
    { vault: { type: VaultType.FUSE }, valueUsd: 0, shareAmount: 0 },
  ];

  it('lists every product in Earn order, with what it holds', () => {
    expect(yieldHoldings(earnAssets, [])).toEqual([
      { type: VaultType.USDC, valueUsd: 2560, shareAmount: 2363.8, unreadUsd: 0, apy: 4.5 },
      { type: VaultType.ETH, valueUsd: 310, shareAmount: 0.0752, unreadUsd: 0, apy: 2.9 },
      { type: VaultType.FUSE, valueUsd: 0, shareAmount: 0, unreadUsd: 0, apy: undefined },
    ]);
  });

  // soEURC is held in EUR, and every holding here feeds a dollar total, so it is not one.
  it('never lists the EUR vault among the USD-valued holdings', () => {
    const holdings = yieldHoldings(
      [...earnAssets, { vault: { type: VaultType.EUR }, valueUsd: 500, shareAmount: 500 }],
      [],
    );
    expect(holdings.map(holding => holding.type)).not.toContain(VaultType.EUR);
  });

  it('counts a production soUSD seen from a development build as USD Yield, once', () => {
    const productionSoUsd = {
      valueUsd: 27,
      balance: 24.7749,
      tokens: [{ contractAddress: PRODUCTION_VAULT_ADDRESSES.fuse.vault, chainId: fuse.id }],
    } as any;
    const usdc = { valueUsd: 80, balance: 80, tokens: [{ contractAddress: '0x1', chainId: 1 }] };
    const [usd] = yieldHoldings(
      [{ vault: { type: VaultType.USDC }, valueUsd: 0, shareAmount: 0 }],
      [productionSoUsd, usdc as any],
    );
    expect(usd).toEqual(
      expect.objectContaining({ valueUsd: 27, shareAmount: 24.7749, unreadUsd: 27 }),
    );
    expect(isYieldShare(productionSoUsd)).toBe(true);
    expect(isYieldShare(usdc as any)).toBe(false);
  });
});

describe('weightedApy', () => {
  it('weights each rate by what is held at it', () => {
    // $2,560 at 4.5%, $310 at 2.9%, $120 at 7.5%.
    expect(
      weightedApy([
        { valueUsd: 2560, apy: 4.5 },
        { valueUsd: 310, apy: 2.9 },
        { valueUsd: 120, apy: 7.5 },
      ]),
    ).toBeCloseTo(4.45, 2);
  });

  it('is zero with nothing held', () => {
    expect(
      weightedApy([
        { valueUsd: 0, apy: 4.5 },
        { valueUsd: undefined, apy: 2.9 },
      ]),
    ).toBe(0);
  });
});
