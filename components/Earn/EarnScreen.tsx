import { useState } from 'react';
import { View } from 'react-native';
import { Href, router } from 'expo-router';

import { BalanceHeadline, BalancePillRow } from '@/components/BalanceHeadline';
import EarnYieldBoostCard from '@/components/Earn/EarnYieldBoostCard';
import LockedFuseTile from '@/components/Earn/LockedFuseTile';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import PageLayout from '@/components/PageLayout';
import SavingsHelpModal from '@/components/Savings/NewSavings/SavingsHelpModal';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useTierMembership } from '@/hooks/useTierMembership';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { type AssetPath } from '@/lib/assets';
import { VaultType } from '@/lib/types';
import { LIVE_VAULTS } from '@/lib/vaults';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import { calculateEstimatedDailyEarnings, resolveVaultApy, type VaultApys } from './earnPortfolio';
import { EarnVaultTile } from './EarnVaultTile';
import { useVaultDetailPrefetch } from './useVaultDetailPrefetch';

const VAULT_TILE_CONTENT = {
  [VaultType.USDC]: {
    assetName: 'USD',
    background: 'images/earn-usd-tile-background.png',
    icon: 'images/earn-usd-icon.png',
  },
  [VaultType.ETH]: {
    assetName: 'ETH',
    background: 'images/earn-eth-tile-background.png',
    icon: 'images/earn-eth-icon.png',
  },
  [VaultType.FUSE]: {
    assetName: 'FUSE',
    background: 'images/earn-fuse-tile-background.png',
    icon: 'images/earn-fuse-icon.png',
  },
  [VaultType.EUR]: {
    assetName: 'EUR',
    // TODO(soEURC): placeholder art — the USD tile background and the EURC token
    // icon until design supplies a EUR tile.
    background: 'images/earn-usd-tile-background.png',
    icon: 'images/eurc.png',
  },
} as const satisfies Record<
  VaultType,
  {
    assetName: string;
    background: AssetPath;
    icon: AssetPath;
  }
>;

/** USD, ETH, FUSE, then any newer vault — and only the vaults a user can deposit into. */
const TILE_ORDER = [VaultType.USDC, VaultType.ETH, VaultType.FUSE, VaultType.EUR];
const VAULT_TILES = TILE_ORDER.filter(type => LIVE_VAULTS.some(vault => vault.type === type)).map(
  type => ({ type, ...VAULT_TILE_CONTENT[type] }),
);

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
  useVaultDetailPrefetch();
  const { data: portfolioTotal, valuesByVault, isLoading } = useTotalSavingsUSD();
  // Deliberately outside the portfolio total: a locked position cannot be
  // withdrawn, and adding it to a headline the withdraw flow then refuses is
  // worse than showing it as its own line.
  const { data: membership } = useTierMembership();
  const openTierUpgrade = useTierUpgradeStore(state => state.open);
  const usdcApy = useMaxAPY(VaultType.USDC);
  const ethApy = useMaxAPY(VaultType.ETH);
  const fuseApy = useMaxAPY(VaultType.FUSE);
  const eurApy = useMaxAPY(VaultType.EUR);

  // soEURC resolves to undefined until it reports a rate, so its tile reads "—".
  const apyByVault: VaultApys = {
    [VaultType.USDC]: resolveVaultApy(VaultType.USDC, usdcApy.maxAPY),
    [VaultType.ETH]: resolveVaultApy(VaultType.ETH, ethApy.maxAPY),
    [VaultType.FUSE]: resolveVaultApy(VaultType.FUSE, fuseApy.maxAPY),
    [VaultType.EUR]: resolveVaultApy(VaultType.EUR, eurApy.maxAPY),
  };
  const apyLoadingByVault: Record<VaultType, boolean> = {
    [VaultType.USDC]: usdcApy.isAPYsLoading,
    [VaultType.ETH]: ethApy.isAPYsLoading,
    [VaultType.FUSE]: fuseApy.isAPYsLoading,
    [VaultType.EUR]: eurApy.isAPYsLoading,
  };
  const areApysLoading = VAULT_TILES.some(vault => apyLoadingByVault[vault.type]);
  // Dollar figures only: the headline and "+$… today" cover the USD-valued vaults,
  // and soEURC (held in EUR) is never converted into them.
  // TODO(soEURC): decide whether Earn shows the EUR balance as its own € line.
  const estimatedToday = valuesByVault
    ? calculateEstimatedDailyEarnings(valuesByVault, apyByVault)
    : 0;

  // Every vault gets a tile regardless of its rate — a vault at 0% is still
  // somewhere to deposit, and a grid that changes shape with the rates is
  // harder to build muscle memory for than one that doesn't.
  const tiles = VAULT_TILES.map(vault => (
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

        {/* Earned on the portfolio as a whole, so it sits with the portfolio
            total rather than on any one vault. */}
        <EarnYieldBoostCard className="mt-[27px]" />

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

          {membership?.lock ? (
            <LockedFuseTile
              lock={membership.lock}
              // No tier named: this screen knows the user wants to top up a
              // lock and not which tier that buys. The flow resolves it to the
              // cheapest one they do not already hold.
              onPress={() => openTierUpgrade()}
            />
          ) : null}
        </View>
      </View>
    </PageLayout>
  );
}
