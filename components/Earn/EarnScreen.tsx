import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Href, router } from 'expo-router';

import BitcoinCoin from '@/assets/images/bitcoin-coin';
import { BalanceHeadline, BalancePillRow } from '@/components/BalanceHeadline';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import PageLayout from '@/components/PageLayout';
import SavingsHelpModal from '@/components/Savings/NewSavings/SavingsHelpModal';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { type AssetPath, getAsset } from '@/lib/assets';
import { isDevFeatureEnabled } from '@/lib/config';
import { VaultType } from '@/lib/types';

import { EarnAssetCard } from './EarnAssetCard';
import { EarnMoreSection } from './EarnMoreSection';
import {
  calculateEstimatedDailyEarnings,
  shouldShowEarnVaultCard,
  type VaultAmounts,
} from './earnPortfolio';

const ICON_SIZE = 26;

const VaultIcon = ({ source }: { source: AssetPath }) => (
  <Image
    source={getAsset(source)}
    contentFit="contain"
    style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
  />
);

const VAULT_CARDS = [
  { type: VaultType.USDC, assetName: 'USD', icon: 'images/usdc-4x.png' },
  { type: VaultType.ETH, assetName: 'ETH', icon: 'images/eth.png' },
  { type: VaultType.FUSE, assetName: 'FUSE', icon: 'images/fuse-4x.png' },
] as const satisfies readonly { type: VaultType; assetName: string; icon: AssetPath }[];

const openVault = (vaultType: VaultType) =>
  router.push({ pathname: '/savings', params: { vault: vaultType } } as Href);

const formatDailyEarnings = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Splits the asset grid into rows so a half-width tile keeps its width when it is alone. */
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

  const visibleVaults = VAULT_CARDS.filter(vault =>
    shouldShowEarnVaultCard(apyByVault[vault.type], apyLoadingByVault[vault.type]),
  );

  const assetTiles = [
    ...visibleVaults.map(vault => (
      <EarnAssetCard
        key={vault.type}
        assetName={vault.assetName}
        icon={<VaultIcon source={vault.icon} />}
        apy={apyByVault[vault.type]}
        isApyLoading={apyLoadingByVault[vault.type]}
        onPress={() => openVault(vault.type)}
      />
    )),
    <EarnAssetCard key="btc" assetName="BTC" icon={<BitcoinCoin size={ICON_SIZE} />} />,
  ];

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

        <Text className="mt-[27px] text-[18px] font-semibold leading-6 text-white">
          Earn on your assets
        </Text>
        <Text className="mb-4 mt-1 text-[14px] leading-5 text-white/50">
          Automated rewards, Withdraw anytime
        </Text>

        <View className="gap-3">
          {chunkIntoRows(assetTiles).map((row, index) => (
            <View key={index} className="flex-row gap-3">
              {row}
              {row.length === 1 && <View className="flex-1" />}
            </View>
          ))}
        </View>

        {/* Tokenized assets are still an in-development feature (the Stocks
            screen itself redirects in production), so the catalog stays out of
            production builds until it ships. */}
        {isDevFeatureEnabled && <EarnMoreSection />}
      </View>
    </PageLayout>
  );
}
