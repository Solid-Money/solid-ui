import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { VaultKey } from '@/constants/withdraw';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useSavingsVaults } from '@/hooks/useSavingsVaults';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { VaultType } from '@/lib/types';

import SavingsFundedActions from './SavingsFundedActions';
import SavingsHelpModal from './SavingsHelpModal';
import SavingsVaultHero from './SavingsVaultHero';
import SimulateSavingsCard from './SimulateSavingsCard';
import StartEarningButton from './StartEarningButton';
import VaultApyHistoryCard from './VaultApyHistoryCard';
import VaultBalanceCard from './VaultBalanceCard';
import { isVaultType } from './vaultDeepLink';
import VaultFaqCard from './VaultFaqCard';
import { hasSelectedVaultFunds } from './vaultFunding';
import VaultStrategyBreakdownCard from './VaultStrategyBreakdownCard';

const VAULT_KEY_BY_TYPE: Record<VaultType, VaultKey> = {
  [VaultType.USDC]: 'USD',
  [VaultType.FUSE]: 'FUSE',
  [VaultType.ETH]: 'ETH',
};

/**
 * Figma 24766:4743 — the detail page reached from an Earn vault card. A
 * funded actions and a vault-specific balance card replace the empty-state CTA
 * only when this selected vault has funds.
 */
export default function SavingsScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.SAVINGS_SCREEN });

  const { vault: vaultParam } = useLocalSearchParams<{ vault?: string }>();
  const selectedVaultType = isVaultType(vaultParam) ? vaultParam : VaultType.USDC;
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { valuesByVault, isLoading: isSavingsLoading } = useTotalSavingsUSD();
  const { vaults: walletVaults, isLoading: isWalletVaultsLoading } = useSavingsVaults();
  const { maxAPY: selectedApy, isAPYsLoading } = useMaxAPY(selectedVaultType);
  const walletVault = walletVaults.find(item => item.key === VAULT_KEY_BY_TYPE[selectedVaultType]);
  const selectedBalanceUsd = Math.max(
    valuesByVault?.[selectedVaultType] ?? 0,
    walletVault?.balanceUSD ?? 0,
  );
  const isBalanceLoading = isSavingsLoading || isWalletVaultsLoading || valuesByVault === undefined;
  const isFunded = hasSelectedVaultFunds(
    valuesByVault,
    selectedVaultType,
    Boolean(walletVault?.tokens.length),
  );

  return (
    <PageLayout
      showNavbar={false}
      edges={['right', 'left', 'bottom']}
      additionalContent={
        <SavingsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      }
    >
      <View className="mx-auto mb-5 w-full max-w-[419px] pb-[140px] web:md:max-w-[40rem]">
        <SavingsVaultHero
          vaultType={selectedVaultType}
          apy={selectedApy}
          isApyLoading={isAPYsLoading}
          onHelpPress={() => setIsHelpOpen(true)}
        />

        <View className="mt-[51px] gap-[46px]">
          {isBalanceLoading ? (
            <Skeleton className="mx-4 h-[50px] rounded-full bg-white/10" />
          ) : isFunded ? (
            <>
              <SavingsFundedActions vaultType={selectedVaultType} />
              <VaultBalanceCard vaultType={selectedVaultType} balanceUsd={selectedBalanceUsd} />
            </>
          ) : (
            <StartEarningButton vaultType={selectedVaultType} />
          )}

          <SimulateSavingsCard apy={selectedApy} />

          <VaultApyHistoryCard vaultType={selectedVaultType} />

          <View className="gap-[17px]">
            <Text className="mx-4 text-[16px] font-normal leading-4 text-white/50">Breakdown</Text>
            <VaultStrategyBreakdownCard vaultType={selectedVaultType} />
          </View>

          <VaultFaqCard />
        </View>
      </View>
    </PageLayout>
  );
}
