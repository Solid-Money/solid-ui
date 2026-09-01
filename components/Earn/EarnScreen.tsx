import { useState } from 'react';
import { View } from 'react-native';
import { Href, router } from 'expo-router';

import { BalanceHeadline, BalancePillRow } from '@/components/BalanceHeadline';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import PageLayout from '@/components/PageLayout';
import SavingsHelpModal from '@/components/Savings/NewSavings/SavingsHelpModal';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { VaultType } from '@/lib/types';

import {
  calculateEstimatedDailyEarnings,
  shouldShowEarnVaultCard,
  type VaultAmounts,
} from './earnPortfolio';
import { EarnVaultCard } from './EarnVaultCard';

const VAULT_CARDS = [
  {
    type: VaultType.USDC,
    assetName: 'USD',
    background: 'images/earn-usd-card-background.png' as const,
  },
  {
    type: VaultType.ETH,
    assetName: 'ETH',
    background: 'images/earn-eth-card-background.png' as const,
  },
  {
    type: VaultType.FUSE,
    assetName: 'FUSE',
    background: 'images/earn-fuse-card-background.png' as const,
  },
] as const;

const openVault = (vaultType: VaultType) =>
  router.push({ pathname: '/savings', params: { vault: vaultType } } as Href);

const formatDailyEarnings = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Figma 24766:2010 — the portfolio-level entry page for every savings vault. */
export default function EarnScreen() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { data: portfolioTotal, valuesByVault, isLoading } = useTotalSavingsUSD();
  const usdcApy = useMaxAPY(VaultType.USDC);
  const ethApy = useMaxAPY(VaultType.ETH);
  const fuseApy = useMaxAPY(VaultType.FUSE);

  const apyByVault: VaultAmounts = {
    [VaultType.USDC]: usdcApy.maxAPY,
    [VaultType.ETH]: ethApy.maxAPY,
    [VaultType.FUSE]: fuseApy.maxAPY,
  };
  const apyLoadingByVault = {
    [VaultType.USDC]: usdcApy.isAPYsLoading,
    [VaultType.ETH]: ethApy.isAPYsLoading,
    [VaultType.FUSE]: fuseApy.isAPYsLoading,
  };
  const areApysLoading = Object.values(apyLoadingByVault).some(Boolean);
  const estimatedToday = valuesByVault
    ? calculateEstimatedDailyEarnings(valuesByVault, apyByVault)
    : 0;

  return (
    <PageLayout
      mobileTitle={null}
      mobileHeaderRightAction="help"
      onMobileHeaderHelpPress={() => setIsHelpOpen(true)}
      desktopHeaderRightAction={
        <HeaderHelpButton
          accessibilityLabel="How savings works"
          onPress={() => setIsHelpOpen(true)}
        />
      }
      additionalContent={
        <SavingsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      }
    >
      <View className="mx-auto w-full max-w-[414px] px-4 pb-[140px] web:md:max-w-[40rem]">
        <View className="gap-5">
          {isLoading || portfolioTotal === undefined ? (
            <View className="items-center gap-1 pt-2">
              <Text className="text-base font-medium text-muted-foreground">Portfolio total</Text>
              <Skeleton className="h-[54px] w-[215px] rounded-xl bg-white/10" />
            </View>
          ) : (
            <BalanceHeadline
              balance={portfolioTotal}
              label="Portfolio total"
              mutedDecimals={false}
            />
          )}

          <BalancePillRow>
            {isLoading || areApysLoading ? (
              <Skeleton className="h-[35px] w-[137px] rounded-full bg-white/10" />
            ) : (
              <View className="h-[35px] justify-center rounded-full bg-[#1C1C1C] px-4">
                <Text className="text-[16px] leading-[18px] text-[#94F27F]">
                  +${formatDailyEarnings(estimatedToday)} today
                </Text>
              </View>
            )}
          </BalancePillRow>
        </View>

        <Text className="mb-[14px] mt-[27px] text-[16px] leading-5 text-white/50">
          Earn interest, Withdraw anytime
        </Text>

        <View className="gap-4">
          {VAULT_CARDS.map(vault => {
            const apy = apyByVault[vault.type];
            const isApyLoading = apyLoadingByVault[vault.type];

            if (!shouldShowEarnVaultCard(apy, isApyLoading)) return null;

            return (
              <EarnVaultCard
                key={vault.type}
                assetName={vault.assetName}
                apy={apy}
                background={vault.background}
                isApyLoading={isApyLoading}
                onPress={() => openVault(vault.type)}
              />
            );
          })}
        </View>
      </View>
    </PageLayout>
  );
}
