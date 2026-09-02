import {
  fallbackTierFees,
  formatFeeValue,
  resolveTierFees,
} from '@/components/Rewards/NewRewards/tierFees';
import { RewardsTier, TierFees } from '@/lib/types';

const ALL_TIERS = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];

/** Every row on the table that has a fee product behind it. */
const feeLines = (fees: TierFees) => fees.lines.filter(line => line.key !== 'virtual_card');

describe('formatFeeValue', () => {
  it('reads "Free" for a zeroed rate rather than "0%"', () => {
    // On a fee table the point of the Ultra column is that the fee is gone;
    // "0%" reads like a fee that happens to be small.
    expect(formatFeeValue(0)).toBe('Free');
  });

  it.each([
    [0.005, '0.5%'],
    [0.0025, '0.25%'],
    [0.0099, '0.99%'],
    [0.01, '1%'],
  ])('renders %s as %s', (rate, expected) => {
    expect(formatFeeValue(rate)).toBe(expected);
  });

  it.each([NaN, Infinity, -0.005])('treats %s as free rather than printing it', rate => {
    expect(formatFeeValue(rate)).toBe('Free');
  });
});

describe('fallbackTierFees', () => {
  it('charges Core 0.5% on every fee product', () => {
    const fees = fallbackTierFees(RewardsTier.CORE);

    expect(feeLines(fees)).not.toHaveLength(0);
    for (const line of feeLines(fees)) {
      expect(line.rate).toBe(0.005);
      expect(line.value).toBe('0.5%');
    }
  });

  it('drops every fee to zero on Ultra', () => {
    const fees = fallbackTierFees(RewardsTier.ULTRA);

    for (const line of feeLines(fees)) {
      expect(line.rate).toBe(0);
      expect(line.value).toBe('Free');
    }
    expect(fees.allFree).toBe(true);
  });

  it('keeps the virtual card free on every tier', () => {
    for (const tier of ALL_TIERS) {
      const card = fallbackTierFees(tier).lines.find(line => line.key === 'virtual_card');
      expect(card).toMatchObject({ rate: 0, value: 'Free' });
    }
  });

  it('lists the fee products in the order the design shows them', () => {
    expect(fallbackTierFees(RewardsTier.CORE).lines.map(line => line.key)).toEqual([
      'virtual_card',
      'bank_deposit',
      'swap',
      'fx',
      'offramp',
    ]);
  });

  it('nudges toward Ultra only on a tier that still pays something', () => {
    expect(fallbackTierFees(RewardsTier.CORE).footnote).toContain('Ultra');
    expect(fallbackTierFees(RewardsTier.PRIME).footnote).toContain('Ultra');
    // Ultra's table already reads Free all the way down.
    expect(fallbackTierFees(RewardsTier.ULTRA).footnote).toBeUndefined();
  });

  it('says staking is not required for Core and quotes an amount above it', () => {
    expect(fallbackTierFees(RewardsTier.CORE).fuseUnlock).toBe('Not required');
    expect(fallbackTierFees(RewardsTier.CORE).fuseUnlockAmount).toBe(0);
    expect(fallbackTierFees(RewardsTier.PRIME).fuseUnlock).toBe('50,000 FUSE');
    expect(fallbackTierFees(RewardsTier.ULTRA).fuseUnlock).toBe('400,000 FUSE');
  });

  it('raises the cashback cap with the tier', () => {
    expect(fallbackTierFees(RewardsTier.CORE).cashbackCap).toContain('50');
    expect(fallbackTierFees(RewardsTier.PRIME).cashbackCap).toContain('100');
    expect(fallbackTierFees(RewardsTier.ULTRA).cashbackCap).toContain('200');
  });
});

describe('resolveTierFees', () => {
  const live: TierFees = {
    lines: [
      { key: 'virtual_card', label: 'Virtual Card', rate: 0, value: 'Free' },
      { key: 'swap', label: 'Swaps', rate: 0.008, value: '0.8%' },
    ],
    cashbackCap: 'Up to $75 monthly',
    fuseUnlockAmount: 60_000,
    fuseUnlock: '60,000 FUSE',
    allFree: false,
    footnote: 'Stake FUSE for Ultra and every fee drops to zero',
  };

  it('prefers the backend table, which is what the biller reads', () => {
    // A rate the admin changed must win over the shipped default, or the screen
    // quotes 0.5% while the engine charges 0.8%.
    expect(resolveTierFees(RewardsTier.CORE, live)).toBe(live);
  });

  it('falls back to the published table when the backend sends none', () => {
    // A qa build can outlive the API it points at; an empty card is worse than
    // the day-one numbers.
    const fees = resolveTierFees(RewardsTier.CORE, undefined);
    expect(fees).toEqual(fallbackTierFees(RewardsTier.CORE));
  });

  it('falls back when the backend sends an empty table', () => {
    const fees = resolveTierFees(RewardsTier.PRIME, {
      ...live,
      lines: [],
    });
    expect(fees).toEqual(fallbackTierFees(RewardsTier.PRIME));
  });
});
