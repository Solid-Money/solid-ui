import { useMemo } from 'react';

import { VAULTS } from '@/constants/vaults';
import { getVaultDepositConfig } from '@/lib/vaults';
import { useSavingStore } from '@/store/useSavingStore';

const useVaultDepositConfig = () => {
  const selectedVaultIndex = useSavingStore(state => state.selectedVault);
  const vault = VAULTS[selectedVaultIndex] ?? VAULTS[0];
  const depositConfig = useMemo(() => getVaultDepositConfig(vault), [vault]);

  return { vault, depositConfig };
};

export default useVaultDepositConfig;
