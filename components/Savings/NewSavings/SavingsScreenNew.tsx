import { useState } from 'react';
import { View } from 'react-native';

import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { VaultType } from '@/lib/types';
import { formatBalanceUSD } from '@/lib/utils';

import ApyDropdown from './ApyDropdown';
import MoreSavingsOptions from './MoreSavingsOptions';
import RecentSavingsActivity from './RecentSavingsActivity';
import SavingsBalanceHeadline from './SavingsBalanceHeadline';
import SavingsFundedActions from './SavingsFundedActions';
import SavingsHelpModal from './SavingsHelpModal';
import SimulateSavingsCard from './SimulateSavingsCard';
import StartEarningButton from './StartEarningButton';
import VaultSavingsSection from './VaultSavingsSection';

import type { ApyByType } from './savingsVaultData';

/**
 * Redesigned savings screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in savings.tsx. Production and all
 * desktop-web users keep the legacy savings screen.
 *
 * Two states share the "Savings Balance" headline + APY pill:
 * - FUNDED (total savings > 0): the selected vault's savings detail + recent
 *   savings activity.
 * - EMPTY (total savings == 0): the "Simulate your savings" projection + other
 *   vault options.
 *
 * "Savings Balance" = total redeemable USD across all vaults (soUSD + soFUSE +
 * soETH). The APY dropdown switches the selected vault everywhere on the screen.
 */
export default function SavingsScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.SAVINGS_SCREEN });

  const [selectedVaultType, setSelectedVaultType] = useState<VaultType>(VaultType.USDC);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { data: totalSavingsUSD, isLoading: isSavingsLoading } = useTotalSavingsUSD();

  const usdcApy = useMaxAPY(VaultType.USDC);
  const fuseApy = useMaxAPY(VaultType.FUSE);
  const ethApy = useMaxAPY(VaultType.ETH);

  const apyByType: ApyByType = {
    [VaultType.USDC]: { maxAPY: usdcApy.maxAPY, isAPYsLoading: usdcApy.isAPYsLoading },
    [VaultType.FUSE]: { maxAPY: fuseApy.maxAPY, isAPYsLoading: fuseApy.isAPYsLoading },
    [VaultType.ETH]: { maxAPY: ethApy.maxAPY, isAPYsLoading: ethApy.isAPYsLoading },
  };

  const savingsBalance = totalSavingsUSD ?? 0;
  const isBalanceLoading = isSavingsLoading || totalSavingsUSD === undefined;
  const mobileTitle = isBalanceLoading ? null : formatBalanceUSD(savingsBalance);
  const selectedApy = apyByType[selectedVaultType].maxAPY;
  const isFunded = savingsBalance > 0;

  return (
    <PageLayout
      mobileTitle={mobileTitle}
      mobileHeaderRightAction="help"
      onMobileHeaderHelpPress={() => setIsHelpOpen(true)}
      additionalContent={
        <SavingsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      }
    >
      <View className="mb-5 w-full gap-8 pb-24">
        {isBalanceLoading ? (
          <View className="items-center gap-6 pt-6">
            <Skeleton className="h-16 w-48 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-14 w-11/12 rounded-full" />
          </View>
        ) : (
          <>
            <View className="gap-5">
              <SavingsBalanceHeadline balance={savingsBalance} />
              <ApyDropdown
                vaultType={selectedVaultType}
                apyByType={apyByType}
                onSelect={setSelectedVaultType}
              />
              {isFunded ? (
                <SavingsFundedActions vaultType={selectedVaultType} />
              ) : (
                <StartEarningButton vaultType={selectedVaultType} />
              )}
            </View>

            {isFunded ? (
              <>
                <VaultSavingsSection vaultType={selectedVaultType} />
                <RecentSavingsActivity />
              </>
            ) : (
              <>
                <SimulateSavingsCard apy={selectedApy} />
                <MoreSavingsOptions
                  selectedType={selectedVaultType}
                  apyByType={apyByType}
                  onSelect={setSelectedVaultType}
                />
              </>
            )}
          </>
        )}
      </View>
    </PageLayout>
  );
}
