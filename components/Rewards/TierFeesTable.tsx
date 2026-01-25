import { useTierTableData } from '@/hooks/useTierTableData';
import { TierTableDocument } from '@/lib/types';

import RewardTable from './RewardTable';

interface TierFeesTableProps {
  tierTable: TierTableDocument;
}

const TierFeesTable = ({ tierTable }: TierFeesTableProps) => {
  const { getTierHeaders, getTableRows } = useTierTableData(tierTable);

  return <RewardTable title="Tier fees & caps" rows={getTableRows} tierHeaders={getTierHeaders} />;
};

export default TierFeesTable;
