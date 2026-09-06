import { Platform } from 'react-native';

import { resolveTierFees } from '@/components/Rewards/NewRewards/tierFees';
import { RewardsTier, TierBenefit, TierBenefits } from '@/lib/types';

import RewardTable, { RewardTableRow } from './RewardTable';

interface TierFeesTableProps {
  tierBenefits: TierBenefits[];
}

/** Fee rows in display order, keyed by the backend's FeeProduct values. */
const FEE_ROWS: { key: string; label: string; subtitle?: string }[] = [
  { key: 'virtual_card', label: 'Virtual card', subtitle: 'Issued instantly' },
  { key: 'bank_deposit', label: 'Bank deposit' },
  // Swap is not available on iOS, so the swap row is omitted there.
  ...(Platform.OS === 'ios' ? [] : [{ key: 'swap', label: 'Swaps' }]),
  { key: 'stocks', label: 'Stocks' },
  { key: 'fx', label: 'FX conversion' },
  { key: 'offramp', label: 'Bank withdrawal' },
];

/**
 * The tier comparison table's fee section.
 *
 * Reads the same per-tier fee table the app's tier screen does, so the desktop
 * comparison and the mobile card show one set of numbers. Every value comes from
 * the live config the charge engine bills from — a fee the table calls "Free"
 * cannot be one a user is charged.
 */
const TierFeesTable = ({ tierBenefits }: TierFeesTableProps) => {
  const sortedTiers = tierBenefits.sort((a, b) => {
    const order = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];
    return order.indexOf(a.tier) - order.indexOf(b.tier);
  });

  const feesByTier = sortedTiers.map(tier => resolveTierFees(tier.tier, tier.fees));

  /** One fee product's value across every tier, as the table's cells. */
  const feeValues = (key: string): (TierBenefit | null)[] =>
    feesByTier.map(fees => {
      const line = fees.lines.find(candidate => candidate.key === key);
      return line ? { title: line.value } : null;
    });

  const rows: RewardTableRow[] = [
    {
      label: 'Card cashback',
      subtitle: 'On every purchase',
      values: sortedTiers.map(tier => tier.cardCashbackCap),
    },
    {
      label: 'Subscription discounts',
      subtitle: 'One subscription per category, per month',
      values: sortedTiers.map(tier => tier.subscriptionDiscountCap),
    },
    ...FEE_ROWS.map(row => ({
      label: row.label,
      subtitle: row.subtitle,
      values: feeValues(row.key),
    })),
    {
      label: 'FUSE unlock',
      subtitle: 'Stake to hold the tier outright',
      values: feesByTier.map(fees => ({ title: fees.fuseUnlock })),
    },
    {
      label: 'Support',
      values: sortedTiers.map(tier => tier.support),
    },
  ];

  return <RewardTable title="Tier fees & caps" rows={rows} tierBenefits={tierBenefits} />;
};

export default TierFeesTable;
