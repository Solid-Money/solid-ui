import { RewardsTier, TierBenefits } from '@/lib/types';

import RewardTable, { RewardTableRow } from './RewardTable';

interface CompareTiersTableProps {
  tierBenefits: TierBenefits[];
}

const CompareTiersTable = ({ tierBenefits }: CompareTiersTableProps) => {
  const sortedTiers = tierBenefits.sort((a, b) => {
    const order = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];
    return order.indexOf(a.tier) - order.indexOf(b.tier);
  });

  const rows: RewardTableRow[] = [
    {
      label: 'Deposit boosts',
      subtitle: 'Campaign-based\ndeposit boosts',
      values: sortedTiers.map(tier => tier.depositBoost),
    },
    {
      label: 'Card cashback',
      subtitle: 'On every purchase',
      values: sortedTiers.map(tier => tier.cardCashback),
    },
    {
      label: 'Subscription discounts',
      subtitle: 'For select monthly\nservices',
      values: sortedTiers.map(tier => tier.subscriptionDiscount),
    },
  ];

  return <RewardTable title="Compare tiers" rows={rows} tierBenefits={tierBenefits} />;
};

export default CompareTiersTable;
