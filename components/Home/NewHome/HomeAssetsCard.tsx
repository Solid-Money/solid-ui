import { Fragment, ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Href, router } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import { isYieldShare, yieldHoldings } from '@/components/Earn/earnPortfolio';
import YieldIcon from '@/components/Earn/YieldIcon';
import {
  formatYieldAmount,
  formatYieldUsd,
  openYieldProduct,
  yieldProductName,
} from '@/components/Earn/yieldProducts';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { usePortfolio } from '@/hooks/usePortfolio';
import { coinAssetPath, formatTokenAmount, PortfolioAsset } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

/** Figma 28441:4773: the three largest holdings, then "Show more" opens the rest. */
export const HOME_ASSET_LIMIT = 3;

export const lockedFuseDescription = (amount: number | undefined, unlockAt?: string | null) => {
  const date = unlockAt ? new Date(unlockAt) : undefined;
  const unlockLabel =
    date && Number.isFinite(date.getTime())
      ? ` · unlocks ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      : '';
  return `${amount === undefined ? '—' : formatNumber(amount, 0)} FUSE${unlockLabel}`;
};

const apyLabel = (apy: number | undefined) =>
  apy !== undefined && Number.isFinite(apy) && apy > 0 ? (
    <Text className="text-[14px] font-normal text-[#94F27F]">{apy.toFixed(1)}% APY</Text>
  ) : undefined;

type HomeAsset = {
  key: string;
  value: number | undefined;
  row: (onPress: () => void) => ReactNode;
  onPress: () => void;
};

/** "Show more ›": the footer row the Assets and Recent activity cards share. */
export const ShowMoreRow = ({
  onPress,
  accessibilityLabel,
  label = 'Show more',
  direction = 'right',
  expanded,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
  /** `right` goes to another screen; `down` / `up` opens or closes the list in place. */
  direction?: 'right' | 'down' | 'up';
  expanded?: boolean;
}) => {
  const Icon = direction === 'down' ? ChevronDown : direction === 'up' ? ChevronUp : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      className="flex-row items-center justify-center gap-1 py-[14px] active:bg-white/5"
    >
      <Text className="text-[14px] leading-5 text-white/70">{label}</Text>
      <Icon size={14} strokeWidth={1.75} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
};

/**
 * Home "Assets" (Figma 28441:4773): one row per holding, largest first, three until
 * "Show more" opens the rest in place.
 * Earnings show as their product (USD Yield, ETH Yield), not the share token behind it,
 * and every row opens its own page. Borrowing lives on the card, not in this list.
 */
export default function HomeAssetsCard({
  portfolio,
}: {
  portfolio: ReturnType<typeof usePortfolio>;
}) {
  const [expanded, setExpanded] = useState(false);
  const openAssets = () => router.push(path.ASSETS);
  const openCash = (asset: PortfolioAsset) =>
    asset.heldInWallet && asset.tokens[0]
      ? router.push(coinAssetPath(asset.tokens[0]) as Href)
      : openAssets();

  // A share token is its product: soUSD is USD Yield. That includes shares the savings reads
  // don't cover — a production soUSD seen from a development build lands in the wallet's
  // tokens, and would otherwise show up here as a plain "soUSD" row.
  const cashAssets = [...portfolio.stableAssets, ...portfolio.cryptoAssets];
  const products = yieldHoldings(portfolio.earnAssets, cashAssets)
    .filter(product => (product.valueUsd ?? 0) > 0)
    .map(({ type, valueUsd, apy }) => ({ type, value: valueUsd, apy }));

  const assets: HomeAsset[] = [
    ...products.map(({ type, value, apy }) => {
      const title = yieldProductName(type);
      return {
        key: `earn:${type}`,
        value,
        onPress: () => router.push(openYieldProduct(type) as Href),
        row: (onPress: () => void) => (
          <AssetRow
            title={title}
            value={value}
            icon={<YieldIcon vaultType={type} />}
            subtitle={apyLabel(apy)}
            onPress={onPress}
          />
        ),
      };
    }),
    // EUR Yield is held in euros: its own row, the dollar estimate only beneath it and for order.
    ...(portfolio.eurYield && portfolio.eurYield.valueEur > 0
      ? [
          {
            key: `earn:${VaultType.EUR}`,
            value: portfolio.eurYield.valueUsdEstimate ?? portfolio.eurYield.valueEur,
            onPress: () => router.push(openYieldProduct(VaultType.EUR) as Href),
            row: (onPress: () => void) => (
              <AssetRow
                title={yieldProductName(VaultType.EUR)}
                value={undefined}
                icon={<YieldIcon vaultType={VaultType.EUR} />}
                subtitle={apyLabel(portfolio.eurYield?.apy)}
                trailing={
                  <View className="shrink-0 items-end gap-[3px]">
                    <Text className="text-[16px] font-semibold text-white">
                      {formatYieldAmount(portfolio.eurYield?.valueEur, VaultType.EUR)}
                    </Text>
                    {portfolio.eurYield?.valueUsdEstimate !== undefined && (
                      <Text className="text-[14px] font-normal text-white/50">
                        ≈ {formatYieldUsd(portfolio.eurYield.valueUsdEstimate)}
                      </Text>
                    )}
                  </View>
                }
                onPress={onPress}
              />
            ),
          },
        ]
      : []),
    ...((portfolio.lockedFuse ?? 0) > 0
      ? [
          {
            key: 'locked',
            value: portfolio.lockedTotal,
            onPress: () => router.push(path.REWARDS),
            row: (onPress: () => void) => (
              <AssetRow
                title="Locked FUSE"
                value={portfolio.lockedTotal}
                icon={<YieldIcon vaultType={VaultType.FUSE} badge="lock" />}
                subtitle={lockedFuseDescription(portfolio.lockedFuse, portfolio.nextUnlockAt)}
                onPress={onPress}
              />
            ),
          },
        ]
      : []),
    ...cashAssets
      .filter(asset => !isYieldShare(asset))
      .map(asset => ({
        key: `cash:${asset.id}`,
        value: asset.valueUsd,
        onPress: () => openCash(asset),
        row: (onPress: () => void) => (
          <AssetRow
            title={asset.symbol}
            value={asset.valueUsd}
            icon={<PortfolioIcon token={asset.tokens[0]} />}
            subtitle={`${formatTokenAmount(asset.balance, asset.stable)} ${asset.symbol}`}
            onPress={onPress}
          />
        ),
      })),
    ...(portfolio.hasCardBalance
      ? [
          {
            key: 'card',
            value: portfolio.cardBalance,
            onPress: () => router.push(path.CARD_INFO),
            row: (onPress: () => void) => (
              <AssetRow
                title="Card balance"
                value={portfolio.cardBalance}
                icon={<PortfolioIcon kind="card" />}
                subtitle="Available on your card"
                onPress={onPress}
              />
            ),
          },
        ]
      : []),
  ].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  // "Show more" opens the rest in place for now; All assets keeps its own way in.
  const shown = expanded ? assets : assets.slice(0, HOME_ASSET_LIMIT);
  const hasMore = assets.length > HOME_ASSET_LIMIT;

  // A new account has nothing to list, so the section stays out of the way entirely.
  if (!portfolio.isLoading && !shown.length && !portfolio.isError) return null;

  return (
    <View className="mt-5 gap-[14px] px-4">
      <Text className="text-[16px] font-normal text-white/50">Assets</Text>
      {portfolio.isLoading ? (
        <View
          accessibilityLabel="Loading assets"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          className="overflow-hidden rounded-[20px] bg-card"
        >
          {[0, 1, 2].map(index => (
            <Fragment key={index}>
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
      ) : shown.length ? (
        <View className="overflow-hidden rounded-[20px] bg-card">
          {shown.map(({ key, row, onPress }, index) => (
            <Fragment key={key}>
              {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
              {row(onPress)}
            </Fragment>
          ))}
          {hasMore && (
            <>
              <View className="h-px bg-[#2A2A2A]" />
              <ShowMoreRow
                onPress={() => setExpanded(value => !value)}
                label={expanded ? 'Show less' : 'Show more'}
                direction={expanded ? 'up' : 'down'}
                expanded={expanded}
                accessibilityLabel={expanded ? 'Show fewer assets' : 'Show all assets'}
              />
            </>
          )}
        </View>
      ) : null}
      {portfolio.isError && (
        <Pressable accessibilityRole="button" onPress={openAssets}>
          <Text className="text-[13px] text-white/50">
            {portfolio.unpricedCashCount > 0
              ? 'Some balances are unavailable or have no price. Open Assets for details.'
              : 'Some balances are unavailable. Open Assets to retry.'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
