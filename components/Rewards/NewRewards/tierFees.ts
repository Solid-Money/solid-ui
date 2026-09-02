import { RewardsTier, TierFeeLine, TierFees } from '@/lib/types';

/**
 * The "Fees & Caps" table, resolved for one tier.
 *
 * The live table comes from the backend, built from the same config the charge
 * engine bills from — so the screen cannot promise "Free" while a fee is being
 * charged, and the three tier tabs cannot round one rate three ways.
 *
 * The fallback below exists because this screen ships on builds that outlive
 * the API they point at: a qa or preview client running against a backend from
 * before the fee program would otherwise render an empty card. It is the
 * published day-one table, so a stale client shows the right numbers rather
 * than nothing — but a live response always wins.
 */

/** Day-one rates: 0.5% on Core, halving at Prime, zero at Ultra. */
const FALLBACK_RATES: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 0.005,
  [RewardsTier.PRIME]: 0.0025,
  [RewardsTier.ULTRA]: 0,
};

/** FUSE that unlocks each tier outright, matching FUSE_STAKING defaults. */
const FALLBACK_FUSE_UNLOCK: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 0,
  [RewardsTier.PRIME]: 50_000,
  [RewardsTier.ULTRA]: 400_000,
};

const FALLBACK_CASHBACK_CAP: Record<RewardsTier, string> = {
  [RewardsTier.CORE]: 'Up to $50 monthly',
  [RewardsTier.PRIME]: 'Up to $100 monthly',
  [RewardsTier.ULTRA]: 'Up to $200 monthly',
};

/** Fee rows in display order. Keys mirror the backend's FeeProduct values. */
const FEE_ROWS: { key: string; label: string }[] = [
  { key: 'bank_deposit', label: 'Bank deposit' },
  { key: 'swap', label: 'Swaps' },
  { key: 'fx', label: 'FX conversion' },
  { key: 'offramp', label: 'Bank withdrawal' },
];

/** A rate as the table shows it: "Free" rather than "0%" when it is gone. */
export const formatFeeValue = (rate: number): string => {
  if (!Number.isFinite(rate) || rate <= 0) return 'Free';
  return `${Number((rate * 100).toFixed(2))}%`;
};

/** The published table for a tier, used when the backend doesn't send one. */
export const fallbackTierFees = (tier: RewardsTier): TierFees => {
  const rate = FALLBACK_RATES[tier] ?? 0;
  const fuseUnlockAmount = FALLBACK_FUSE_UNLOCK[tier] ?? 0;

  const feeLines: TierFeeLine[] = FEE_ROWS.map(row => ({
    ...row,
    rate,
    value: formatFeeValue(rate),
  }));

  const allFree = feeLines.every(line => line.rate <= 0);

  return {
    // The virtual card has no fee product behind it — issuing and holding one is
    // free on every tier — and saying so next to the fees that do exist is the
    // point of the table.
    lines: [{ key: 'virtual_card', label: 'Virtual Card', rate: 0, value: 'Free' }, ...feeLines],
    cashbackCap: FALLBACK_CASHBACK_CAP[tier] ?? 'Up to $50 monthly',
    fuseUnlockAmount,
    fuseUnlock: fuseUnlockAmount
      ? `${fuseUnlockAmount.toLocaleString('en-US')} FUSE`
      : 'Not required',
    allFree,
    footnote: allFree ? undefined : 'Stake FUSE for Ultra and every fee drops to zero',
  };
};

/**
 * The fee table to render for a tier.
 *
 * Prefers the backend's, which is authoritative; falls back to the published
 * table when a response has no `fees` block at all. A response that arrived with
 * an empty `lines` array is treated as missing too — an empty card is never the
 * intended answer.
 */
export const resolveTierFees = (tier: RewardsTier, fees: TierFees | undefined): TierFees => {
  if (fees?.lines?.length) return fees;
  return fallbackTierFees(tier);
};
