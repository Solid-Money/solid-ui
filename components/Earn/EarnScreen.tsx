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
import { type AssetPath } from '@/lib/assets';
import { isDevFeatureEnabled } from '@/lib/config';
import { VaultType } from '@/lib/types';

import { EarnInvestSection } from './EarnInvestSection';
import {
  calculateEstimatedDailyEarnings,
  shouldShowEarnVaultCard,
  type VaultAmounts,
} from './earnPortfolio';
import { EarnVaultTile } from './EarnVaultTile';

const VAULT_TILES = [
  {
    type: VaultType.USDC,
    assetName: 'USD',
    background: 'images/earn-usd-tile-background.png',
    icon: 'images/earn-usd-icon.png',
  },
  {
    type: VaultType.ETH,
    assetName: 'ETH',
    background: 'images/earn-eth-tile-background.png',
    icon: 'images/earn-eth-icon.png',
  },
  {
    type: VaultType.FUSE,
    assetName: 'FUSE',
    background: 'images/earn-fuse-tile-background.png',
    icon: 'images/earn-fuse-icon.png',
  },
] as const satisfies readonly {
  type: VaultType;
  assetName: string;
  background: AssetPath;
  icon: AssetPath;
}[];

const openVault = (vaultType: VaultType) =>
  router.push({ pathname: '/savings', params: { vault: vaultType } } as Href);

const formatDailyEarnings = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Splits the tiles into rows so a half-width tile keeps its width when it is alone. */
const chunkIntoRows = <T,>(items: T[], perRow = 2): T[][] =>
  items.reduce<T[][]>((rows, item, index) => {
    if (index % perRow === 0) rows.push([]);
    rows[rows.length - 1].push(item);
    return rows;
  }, []);

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

  const tiles = VAULT_TILES.filter(vault =>
    shouldShowEarnVaultCard(apyByVault[vault.type], apyLoadingByVault[vault.type]),
  ).map(vault => (
    <EarnVaultTile
      key={vault.type}
      assetName={vault.assetName}
      apy={apyByVault[vault.type]}
      isApyLoading={apyLoadingByVault[vault.type]}
      background={vault.background}
      icon={vault.icon}
      onPress={() => openVault(vault.type)}
    />
  ));

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
              <Skeleton className="h-6 w-[120px] rounded-full bg-white/10" />
            ) : (
              <Text className="text-[16px] leading-5 text-[#94F27F]">
                +${formatDailyEarnings(estimatedToday)} today
              </Text>
            )}
          </BalancePillRow>
        </View>

        <Text className="mb-[14px] mt-[27px] text-[16px] leading-5 text-white/50">
          Earn interest, Withdraw anytime
        </Text>

        <View className="gap-4">
          {chunkIntoRows(tiles).map((row, index) => (
            <View key={index} className="flex-row gap-4">
              {row}
              {row.length === 1 && <View className="flex-1" />}
            </View>
          ))}
        </View>

        {/* Tokenized assets are still an in-development feature (the Stocks
            screen itself redirects in production), so the catalog stays out of
            production builds until it ships. */}
        {isDevFeatureEnabled && <EarnInvestSection />}
      </View>
    </PageLayout>
  );
}
