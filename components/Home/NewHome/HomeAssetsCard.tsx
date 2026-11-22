import { Fragment, ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Href, router } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import WithdrawingRow, {
  openPendingWithdrawals,
  pendingWithdrawalsUsd,
  withdrawingSubtitle,
} from '@/components/Assets/WithdrawingRow';
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

import type { HomeSnapshotAsset } from '@/lib/homeSnapshot';

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

/** EUR Yield's amount column (Figma 29123:9541): euros, with the dollar estimate beneath. */
export const EurYieldAmount = ({
  eurYield,
}: {
  eurYield: NonNullable<ReturnType<typeof usePortfolio>['eurYield']>;
}) => (
  <View className="shrink-0 items-end gap-[3px]">
    <Text className="text-[16px] font-semibold text-white">
      {formatYieldAmount(eurYield.valueEur, VaultType.EUR)}
    </Text>
    {eurYield.valueUsdEstimate !== undefined && (
      <Text className="text-[14px] font-normal text-white/50">
        ≈ {formatYieldUsd(eurYield.valueUsdEstimate)}
      </Text>
    )}
  </View>
);

type HomeAsset = {
  key: string;
  value: number | undefined;
  row: (onPress: () => void) => ReactNode;
  onPress: () => void;
  /** The row as plain data, kept so the next launch can draw it before anything loads. */
  snapshot: HomeSnapshotAsset;
};

type Portfolio = ReturnType<typeof usePortfolio>;

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

const withdrawalsHref = (withdrawals: Portfolio['pendingWithdrawals']): Href =>
  withdrawals.length === 1 ? (`/activity/${withdrawals[0].clientTxId}` as Href) : path.ACTIVITY;

const cashHref = (asset: PortfolioAsset): Href =>
  asset.heldInWallet && asset.tokens[0] ? (coinAssetPath(asset.tokens[0]) as Href) : path.ASSETS;

/**
 * Every Assets row, largest first, each with what it draws, where it goes and the same row as
 * plain data for the home snapshot (lib/homeSnapshot). One list, so what the next launch draws
 * before anything loads is exactly what this card drew last.
 */
export const buildHomeAssets = (portfolio: Portfolio): HomeAsset[] => {
  // A share token is its product: soUSD is USD Yield. That includes shares the savings reads
  // don't cover — a production soUSD seen from a development build lands in the wallet's
  // tokens, and would otherwise show up here as a plain "soUSD" row.
  const cashAssets = [...portfolio.stableAssets, ...portfolio.cryptoAssets];
  const products = yieldHoldings(portfolio.earnAssets, cashAssets)
    .filter(product => (product.valueUsd ?? 0) > 0)
    .map(({ type, valueUsd, apy }) => ({ type, value: valueUsd, apy }));
  const eurYield = portfolio.eurYield;

  return [
    ...products.map(({ type, value, apy }) => {
      const title = yieldProductName(type);
      const href = openYieldProduct(type) as Href;
      return {
        key: `earn:${type}`,
        value,
        onPress: () => router.push(href),
        row: (onPress: () => void) => (
          <AssetRow
            title={title}
            value={value}
            icon={<YieldIcon vaultType={type} />}
            subtitle={apyLabel(apy)}
            onPress={onPress}
          />
        ),
        snapshot: {
          key: `earn:${type}`,
          title,
          value,
          apy,
          icon: { type: 'yield', vaultType: type },
          href,
        },
      } satisfies HomeAsset;
    }),
    // EUR Yield is held in euros: its own row, the dollar estimate only beneath it and for order.
    ...(eurYield && eurYield.valueEur > 0
      ? [
          {
            key: `earn:${VaultType.EUR}`,
            value: eurYield.valueUsdEstimate ?? eurYield.valueEur,
            onPress: () => router.push(openYieldProduct(VaultType.EUR) as Href),
            row: (onPress: () => void) => (
              <AssetRow
                title={yieldProductName(VaultType.EUR)}
                value={undefined}
                icon={<YieldIcon vaultType={VaultType.EUR} />}
                subtitle={apyLabel(eurYield.apy)}
                trailing={<EurYieldAmount eurYield={eurYield} />}
                onPress={onPress}
              />
            ),
            snapshot: {
              key: `earn:${VaultType.EUR}`,
              title: yieldProductName(VaultType.EUR),
              apy: eurYield.apy,
              amountLines: {
                primary: formatYieldAmount(eurYield.valueEur, VaultType.EUR),
                secondary:
                  eurYield.valueUsdEstimate !== undefined
                    ? `≈ ${formatYieldUsd(eurYield.valueUsdEstimate)}`
                    : undefined,
              },
              icon: { type: 'yield', vaultType: VaultType.EUR },
              href: openYieldProduct(VaultType.EUR) as Href,
            },
          } satisfies HomeAsset,
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
            snapshot: {
              key: 'locked',
              title: 'Locked FUSE',
              value: portfolio.lockedTotal,
              subtitle: lockedFuseDescription(portfolio.lockedFuse, portfolio.nextUnlockAt),
              icon: { type: 'yield', vaultType: VaultType.FUSE, badge: 'lock' },
              href: path.REWARDS,
            },
          } satisfies HomeAsset,
        ]
      : []),
    ...cashAssets
      .filter(asset => !isYieldShare(asset))
      .map(asset => {
        const subtitle = `${formatTokenAmount(asset.balance, asset.stable)} ${asset.symbol}`;
        const href = cashHref(asset);
        return {
          key: `cash:${asset.id}`,
          value: asset.valueUsd,
          onPress: () => router.push(href),
          row: (onPress: () => void) => (
            <AssetRow
              title={asset.symbol}
              value={asset.valueUsd}
              icon={<PortfolioIcon token={asset.tokens[0]} />}
              subtitle={subtitle}
              onPress={onPress}
            />
          ),
          snapshot: {
            key: `cash:${asset.id}`,
            title: asset.symbol,
            value: asset.valueUsd,
            subtitle,
            icon: {
              type: 'token',
              symbol: asset.tokens[0]?.contractTickerSymbol ?? asset.symbol,
              logoUrl: asset.tokens[0]?.logoUrl,
            },
            href,
          },
        } satisfies HomeAsset;
      }),
    // Left savings, not in the wallet yet. Without this row the balance counts it and no row does.
    ...(portfolio.pendingWithdrawals.length > 0
      ? [
          {
            key: 'withdrawing',
            value: pendingWithdrawalsUsd(portfolio.pendingWithdrawals),
            onPress: () => openPendingWithdrawals(portfolio.pendingWithdrawals),
            row: () => <WithdrawingRow withdrawals={portfolio.pendingWithdrawals} />,
            snapshot: {
              key: 'withdrawing',
              title: 'Withdrawing',
              value: pendingWithdrawalsUsd(portfolio.pendingWithdrawals),
              subtitle: withdrawingSubtitle(portfolio.pendingWithdrawals),
              icon: {
                type: 'kind',
                kind: portfolio.pendingWithdrawals.every(item => item.vault === 'ETH')
                  ? 'eth'
                  : 'usdc',
              },
              href: withdrawalsHref(portfolio.pendingWithdrawals),
            },
          } satisfies HomeAsset,
        ]
      : []),
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
            snapshot: {
              key: 'card',
              title: 'Card balance',
              value: portfolio.cardBalance,
              subtitle: 'Available on your card',
              icon: { type: 'kind', kind: 'card' },
              href: path.CARD_INFO,
            },
          } satisfies HomeAsset,
        ]
      : []),
  ].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
};

const snapshotIcon = (icon: HomeSnapshotAsset['icon']) =>
  icon.type === 'yield' ? (
    <YieldIcon vaultType={icon.vaultType} badge={icon.badge} />
  ) : icon.type === 'token' ? (
    <PortfolioIcon symbol={icon.symbol} logoUrl={icon.logoUrl} />
  ) : (
    <PortfolioIcon kind={icon.kind} />
  );

/** A row as the home snapshot remembers it: the same row, drawn from plain data. */
const SnapshotRow = ({ asset }: { asset: HomeSnapshotAsset }) => (
  <AssetRow
    title={asset.title}
    value={asset.amountLines ? undefined : asset.value}
    icon={snapshotIcon(asset.icon)}
    subtitle={asset.subtitle ?? apyLabel(asset.apy)}
    trailing={
      asset.amountLines && (
        <View className="shrink-0 items-end gap-[3px]">
          <Text className="text-[16px] font-semibold text-white">{asset.amountLines.primary}</Text>
          {asset.amountLines.secondary !== undefined && (
            <Text className="text-[14px] font-normal text-white/50">
              {asset.amountLines.secondary}
            </Text>
          )}
        </View>
      )
    }
    onPress={() => router.push(asset.href)}
  />
);

const AssetsSkeleton = () => (
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
);

/**
 * Home "Assets" (Figma 28441:4773): one row per holding, largest first, three until
 * "Show more" opens the rest in place.
 * Earnings show as their product (USD Yield, ETH Yield), not the share token behind it,
 * and every row opens its own page. Borrowing lives on the card, not in this list.
 *
 * While the live figures load, `lastKnown` (the rows this card drew last time, from the home
 * snapshot) stands in for the skeleton when there is one.
 */
export default function HomeAssetsCard({
  portfolio,
  lastKnown,
}: {
  portfolio: Portfolio;
  lastKnown?: HomeSnapshotAsset[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const openAssets = () => router.push(path.ASSETS);

  const assets = buildHomeAssets(portfolio);
  const showLastKnown = portfolio.isLoading && !!lastKnown?.length;
  const count = showLastKnown ? lastKnown.length : assets.length;

  // "Show more" opens the rest in place for now; All assets keeps its own way in.
  const shown = expanded ? assets : assets.slice(0, HOME_ASSET_LIMIT);
  const shownLastKnown = showLastKnown
    ? expanded
      ? lastKnown
      : lastKnown.slice(0, HOME_ASSET_LIMIT)
    : [];
  const hasMore = count > HOME_ASSET_LIMIT;

  // A new account has nothing to list, so the section stays out of the way entirely.
  if (!portfolio.isLoading && !shown.length && !portfolio.isError) return null;

  return (
    <View className="mt-5 gap-[14px] px-4">
      <Text className="text-[16px] font-normal text-white/50">Assets</Text>
      {portfolio.isLoading && !showLastKnown ? (
        <AssetsSkeleton />
      ) : showLastKnown || shown.length ? (
        <View
          className="overflow-hidden rounded-[20px] bg-card"
          accessibilityState={showLastKnown ? { busy: true } : undefined}
        >
          {showLastKnown
            ? shownLastKnown.map((asset, index) => (
                <Fragment key={asset.key}>
                  {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
                  <SnapshotRow asset={asset} />
                </Fragment>
              ))
            : shown.map(({ key, row, onPress }, index) => (
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
      {!portfolio.isLoading && portfolio.isError && (
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
