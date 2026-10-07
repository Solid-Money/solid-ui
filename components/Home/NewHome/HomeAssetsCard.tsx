import { Fragment, ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { usePortfolio } from '@/hooks/usePortfolio';
import { cashGroupTotal, splitSmallBalances, sumKnownValues } from '@/lib/portfolio';
import { formatNumber } from '@/lib/utils';

export const lockedFuseDescription = (amount: number | undefined, unlockAt?: string | null) => {
  const date = unlockAt ? new Date(unlockAt) : undefined;
  const unlockLabel =
    date && Number.isFinite(date.getTime())
      ? ` · unlocks ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      : '';
  return `${amount === undefined ? '—' : formatNumber(amount, 0)} FUSE${unlockLabel}`;
};

const tickerList = (symbols: string[]) => {
  const unique = [...new Set(symbols)];
  return `${unique.slice(0, 3).join(', ')}${unique.length > 3 ? ` +${unique.length - 3}` : ''}`;
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
  // Same groups as the Assets screen: Stablecoins, Earn (vault shares and the FUSE lock),
  // Crypto. Each row takes the logo of its largest holding.
  const showLocked = (portfolio.lockedFuse ?? 0) > 0;
  const fundedEarn = portfolio.earnAssets
    .filter(asset => (asset.valueUsd ?? 0) > 0)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  // Earn still shows when its value is unknown ("—").
  const showEarn = portfolio.earnTotal !== 0 || showLocked;
  const earnValue = sumKnownValues([
    portfolio.earnTotal,
    showLocked ? portfolio.lockedTotal : 0,
  ]).total;
  const maxApy = Math.max(0, ...fundedEarn.map(asset => asset.apy ?? 0));
  const earnSymbols = tickerList([
    ...fundedEarn.map(asset => asset.vault.vaultToken),
    ...(showLocked ? ['locked FUSE'] : []),
  ]);
  const stableTickers = tickerList(
    splitSmallBalances(portfolio.stableAssets).visible.map(asset => asset.symbol),
  );
  const cryptoTickers = tickerList(
    splitSmallBalances(portfolio.cryptoAssets).visible.map(asset => asset.symbol),
  );
  const showCrypto = portfolio.cryptoAssets.length > 0;
  // Stablecoins is the fallback row, so a new user's card is never empty.
  const showStable =
    portfolio.stableAssets.length > 0 || portfolio.hasCardBalance || (!showEarn && !showCrypto);
  const topEarn = fundedEarn[0];
  const rows: { key: string; row: ReactNode }[] = [];
  if (showStable)
    rows.push({
      key: 'stable',
      row: (
        <AssetRow
          title="Stablecoins"
          value={cashGroupTotal(portfolio.stableTotal, portfolio.cardBalance)}
          icon={<PortfolioIcon token={portfolio.stableAssets[0]?.tokens[0]} symbol="USDC" />}
          subtitle={
            stableTickers ||
            (portfolio.hasCardBalance
              ? 'Card balance'
              : portfolio.stableAssets.length
                ? 'Small balances'
                : 'No stablecoins yet')
          }
        />
      ),
    });
  if (showEarn)
    rows.push({
      key: 'earn',
      row: (
        <AssetRow
          title="Earn"
          value={earnValue}
          icon={
            topEarn ? (
              <PortfolioIcon token={topEarn.walletTokens[0]} symbol={topEarn.vault.vaultToken} />
            ) : (
              <PortfolioIcon symbol="FUSE" locked={showLocked} />
            )
          }
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
      ),
    });
  if (showCrypto)
    rows.push({
      key: 'crypto',
      row: (
        <AssetRow
          title="Crypto"
          value={portfolio.cryptoTotal}
          icon={<PortfolioIcon token={portfolio.cryptoAssets[0]?.tokens[0]} />}
          subtitle={cryptoTickers || 'Small balances'}
        />
      ),
    });
  if (hasDebt)
    rows.push({
      key: 'debt',
      row: (
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
      ),
    });
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
        <View
          accessibilityLabel="Loading assets"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          className="overflow-hidden rounded-[20px] bg-card"
        >
          {rows.map(({ key }, index) => (
            <Fragment key={key}>
              {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
              <View className="flex-row items-center gap-[12px] px-[16px] py-[14px]">
                <Skeleton className="h-10 w-10 rounded-full" />
                <View className="min-w-0 flex-1 gap-[3px]">
                  <Skeleton className="h-4 w-24 max-w-full" />
                  <Skeleton className="h-3 w-32 max-w-full" />
                </View>
                <Skeleton className="h-4 w-[72px]" />
              </View>
            </Fragment>
          ))}
        </View>
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
          {rows.map(({ key, row }, index) => (
            <Fragment key={key}>
              {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
              {row}
            </Fragment>
          ))}
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
