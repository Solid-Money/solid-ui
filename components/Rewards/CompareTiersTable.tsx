import { useTierTableData } from '@/hooks/useTierTableData';
import { TierTableDocument } from '@/lib/types';

import RewardTable from './RewardTable';

interface CompareTiersTableProps {
  tierTable: TierTableDocument;
}

const CompareTiersTable = ({ tierTable }: CompareTiersTableProps) => {
  const { getTierHeaders, getTableRows } = useTierTableData(tierTable);

  return <RewardTable title="Compare tiers" rows={getTableRows} tierHeaders={getTierHeaders} />;
};

export default CompareTiersTable;
