import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { usePortfolio } from '@/hooks/usePortfolio';
import { cashGroupTotal, splitSmallBalances } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

export const lockedFuseDescription = (amount: number | undefined, unlockAt?: string | null) => {
  const date = unlockAt ? new Date(unlockAt) : undefined;
  const unlockLabel =
    date && Number.isFinite(date.getTime())
      ? ` · unlocks ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      : '';
  return `${amount === undefined ? '—' : formatNumber(amount, 0)} FUSE${unlockLabel}`;
};

export default function HomeAssetsCard({
  portfolio,
  borrowApy,
  onRepay,
}: {
  portfolio: ReturnType<typeof usePortfolio>;
  /** Display string from the spend-mode figures, e.g. "5.57%". */
  borrowApy?: string;
  onRepay?: () => void;
}) {
  const openAssets = () => router.push(path.ASSETS);
  const hasDebt = (portfolio.debt ?? 0) > 0;
  // Empty groups are left out; Earn still shows when its value is unknown ("—").
  const showEarn = portfolio.earnTotal !== 0;
  const showLocked = (portfolio.lockedFuse ?? 0) > 0;
  const fundedEarn = portfolio.earnAssets.filter(asset => (asset.valueUsd ?? 0) > 0);
  const maxApy = Math.max(0, ...fundedEarn.map(asset => asset.apy ?? 0));
  const earnSymbols = fundedEarn
    .map(asset => (asset.vault.type === VaultType.USDC ? 'USD' : asset.vault.type.toUpperCase()))
    .join(', ');
  const { visible: visibleCash } = splitSmallBalances(portfolio.cashAssets);
  const cashTickers = [...new Set(visibleCash.map(asset => asset.symbol))];
  const cashSymbols = `${cashTickers.slice(0, 3).join(', ')}${cashTickers.length > 3 ? ` +${cashTickers.length - 3}` : ''}`;
  return (
    <View className="mt-5 gap-[14px] px-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[16px] font-normal text-white/50">Assets</Text>
        <Pressable
          onPress={openAssets}
          accessibilityRole="button"
          accessibilityLabel="See all assets"
          className="rounded-full bg-card px-[13px] pb-[3px] pt-[4px]"
        >
          <Text className="text-[14px] font-medium text-white/70">See all</Text>
        </Pressable>
      </View>
      {portfolio.isLoading ? (
        <Skeleton className="h-[224px] rounded-[20px]" />
      ) : (
        <Pressable
          onPress={openAssets}
          accessibilityRole="button"
          accessibilityLabel="Open assets overview"
          android_ripple={
            Platform.OS === 'android'
              ? { color: 'rgba(255, 255, 255, 0.08)', foreground: true }
              : undefined
          }
          className="ios:active:bg-[#2A2A2A] native:transition-transform native:duration-200 native:ease-out native:active:scale-[0.98] native:active:opacity-90 overflow-hidden rounded-[20px] bg-card"
        >
          {showEarn && (
            <AssetRow
              title="Earn"
              value={portfolio.earnTotal}
              icon={<PortfolioIcon kind="usd" />}
              subtitle={
                maxApy > 0 ? (
                  <>
                    <Text className="text-[#94F27F]">Up to {maxApy.toFixed(1)}% APY</Text>
                    {earnSymbols ? ` · ${earnSymbols}` : ''}
                  </>
                ) : (
                  earnSymbols || 'Start earning'
                )
              }
            />
          )}
          {showLocked && (
            <>
              {showEarn && <View className="h-px bg-[#2A2A2A]" />}
              <AssetRow
                title="Locked FUSE"
                value={portfolio.lockedTotal}
                icon={<PortfolioIcon kind="fuse" locked />}
                subtitle={lockedFuseDescription(portfolio.lockedFuse, portfolio.nextUnlockAt)}
              />
            </>
          )}
          {(showEarn || showLocked) && <View className="h-px bg-[#2A2A2A]" />}
          <AssetRow
            title="Cash"
            value={cashGroupTotal(portfolio.cashTotal, portfolio.cardBalance)}
            icon={<PortfolioIcon kind="usdc" />}
            subtitle={
              cashSymbols ||
              (portfolio.hasCardBalance
                ? 'Card balance'
                : portfolio.cashAssets.length
                  ? 'Small balances'
                  : 'No cash balances')
            }
          />
          {hasDebt && (
            <>
              <View className="h-px bg-[#2A2A2A]" />
              <AssetRow
                title="Borrowed"
                value={-portfolio.debt!}
                icon={<PortfolioIcon kind="card" />}
                subtitle={
                  portfolio.creditDetailsAvailable && borrowApy
                    ? `${borrowApy} APY · tap to repay`
                    : 'Credit details unavailable'
                }
                onPress={portfolio.creditDetailsAvailable ? onRepay : undefined}
              />
            </>
          )}
        </Pressable>
      )}
      {portfolio.isError && (
        <Text className="text-[13px] text-white/50">
          {portfolio.unpricedCashCount > 0
            ? 'Some balances are unavailable or have no price. Open Assets for details.'
            : 'Some balances are unavailable. Open Assets to retry.'}
        </Text>
      )}
    </View>
  );
}
