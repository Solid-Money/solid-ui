import { RewardsTier, TierBenefits } from '@/lib/types';

import RewardTable, { RewardTableRow } from './RewardTable';

interface TierFeesTableProps {
  tierBenefits: TierBenefits[];
}

const TierFeesTable = ({ tierBenefits }: TierFeesTableProps) => {
  const sortedTiers = tierBenefits.sort((a, b) => {
    const order = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];
    return order.indexOf(a.tier) - order.indexOf(b.tier);
  });

  const rows: RewardTableRow[] = [
    {
      label: 'Card cashback',
      subtitle: 'On every purchase',
      values: sortedTiers.map(tier => tier.cardCashbackCap),
    },
    {
      label: 'Subscription discounts',
      subtitle: 'For select monthly services',
      values: sortedTiers.map(tier => tier.subscriptionDiscountCap),
    },
    {
      label: 'Card fees',
      values: sortedTiers.map(tier => tier.cardFees),
    },
    {
      label: 'Bank deposit',
      values: sortedTiers.map(tier => tier.bankDeposit),
    },
    {
      label: 'Swaps',
      values: sortedTiers.map(tier => tier.swapFees),
    },
    {
      label: 'Support',
      values: sortedTiers.map(tier => tier.support),
    },
  ];

  return <RewardTable title="Tier fees & caps" rows={rows} tierBenefits={tierBenefits} />;
};

export default TierFeesTable;
