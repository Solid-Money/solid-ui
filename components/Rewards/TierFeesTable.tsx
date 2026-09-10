import { Platform } from 'react-native';

import { feeTableRows, resolveTierFees } from '@/components/Rewards/NewRewards/tierFees';
import { RewardsTier, TierBenefit, TierBenefits } from '@/lib/types';

import RewardTable, { RewardTableRow } from './RewardTable';

interface TierFeesTableProps {
  tierBenefits: TierBenefits[];
}

/**
 * Per-row copy this table owns, keyed by the backend's row keys.
 *
 * Labels otherwise come from the response, so the rows an admin switches on and
 * off in the dashboard reach this table without a client release. The overrides
 * here are only where this table's wording has always differed from the tier
 * card's — a row the map doesn't mention renders exactly as the backend named it.
 */
const ROW_COPY: Record<string, { label?: string; subtitle?: string }> = {
  virtual_card: { label: 'Virtual card', subtitle: 'Issued instantly' },
};

/** Rows this platform never shows, whatever the backend sends. */
const HIDDEN_ROW_KEYS = new Set(
  // Swap is not available on iOS, so the swap row is omitted there.
  Platform.OS === 'ios' ? ['swap'] : [],
);

/**
 * The tier comparison table's fee section.
 *
 * Reads the same per-tier fee table the app's tier screen does, so the desktop
 * comparison and the mobile card show one set of numbers. Every value comes from
 * the live config the charge engine bills from — a fee the table calls "Free"
 * cannot be one a user is charged.
 *
 * Which rows exist is the backend's answer too, not a list held here: a product
 * an admin has switched off for display is simply absent from the response. A
 * hardcoded list would keep rendering the row with an empty cell under every
 * tier.
 */
const TierFeesTable = ({ tierBenefits }: TierFeesTableProps) => {
  const sortedTiers = tierBenefits.sort((a, b) => {
    const order = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];
    return order.indexOf(a.tier) - order.indexOf(b.tier);
  });

  const feesByTier = sortedTiers.map(tier => resolveTierFees(tier.tier, tier.fees));

  const feeRows = feeTableRows(feesByTier, HIDDEN_ROW_KEYS);

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
    ...feeRows.map(row => ({
      label: ROW_COPY[row.key]?.label ?? row.label,
      subtitle: ROW_COPY[row.key]?.subtitle,
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
