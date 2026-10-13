import { Fragment, ReactNode, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Href, router } from 'expo-router';

import AssetRow, { assetAmountLabel } from '@/components/Assets/AssetRow';
import PortfolioIcon, { PORTFOLIO_ICONS } from '@/components/Assets/PortfolioIcon';
import { BalanceHeadline } from '@/components/BalanceHeadline';
import BorrowPositionSheet from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheet';
import { useSpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { lockedFuseDescription } from '@/components/Home/NewHome/HomeAssetsCard';
import { bankBalancesToShow } from '@/components/Home/NewHome/OtherBalancesDropdown/balanceTotals';
import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWirexUnifiedBalances } from '@/hooks/useWirexBankAccounts';
import {
  coinAssetPath,
  formatTokenAmount,
  PortfolioAsset,
  splitSmallBalances,
  yieldEstimate,
} from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { getEarningTokenVault } from '@/lib/vaults';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import type { BankBalance } from '@/components/Home/NewHome/OtherBalancesDropdown/balanceTotals';

const Divider = () => <View className="h-px bg-[#2A2A2A]" />;
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <View className="gap-[12px]">
    <Text className="px-[4px] text-[16px] font-normal text-white/50">{title}</Text>
    <View className="overflow-hidden rounded-[20px] bg-card">{children}</View>
  </View>
);
type EarnAsset = ReturnType<typeof usePortfolio>['earnAssets'][number];
type HoldingKind = 'stable' | 'crypto';
type HoldingList = { all: PortfolioAsset[]; shown: PortfolioAsset[]; small: PortfolioAsset[] };

/** "3,704.88 soUSD · 2 networks", or the underlying amount when no share balance is known. */
const earnDetails = (asset: EarnAsset): string[] => {
  const details: string[] = [];
  if (asset.shareAmount !== undefined && asset.vault.vaultToken)
    details.push(`${formatTokenAmount(asset.shareAmount)} ${asset.vault.vaultToken}`);
  else if (asset.vault.type !== VaultType.USDC && asset.underlyingAmount !== undefined)
    details.push(`${formatTokenAmount(asset.underlyingAmount)} ${asset.vault.type.toUpperCase()}`);
  if (asset.backsCredit) details.push('backs your credit');
  else if (asset.shareNetworkCount > 1) details.push(`${asset.shareNetworkCount} networks`);
  return details;
};

/** "21.00 USDC · 3 networks" */
const holdingDetails = (asset: PortfolioAsset) =>
  [
    `${formatTokenAmount(asset.balance, asset.stable)} ${asset.symbol}`,
    asset.networkCount > 1 && `${asset.networkCount} networks`,
    asset.valueUsd === undefined && 'no price',
    asset.backsCredit && 'backs your credit',
  ]
    .filter(Boolean)
    .join(' · ');

export function AssetsOverview({
  portfolio,
  figures,
  bankBalances,
  refetchAll,
  isRefreshing,
}: {
  portfolio: ReturnType<typeof usePortfolio>;
  figures: SpendModeFigures;
  bankBalances: BankBalance[];
  refetchAll: () => Promise<void>;
  isRefreshing: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<HoldingKind, boolean>>({
    stable: false,
    crypto: false,
  });
  const [borrowOpen, setBorrowOpen] = useState(false);
  const holdings = (assets: PortfolioAsset[], kind: HoldingKind): HoldingList => {
    const { visible, small } = splitSmallBalances(assets);
    return { all: assets, shown: expanded[kind] ? assets : visible, small };
  };
  const stable = holdings(portfolio.stableAssets, 'stable');
  const crypto = holdings(portfolio.cryptoAssets, 'crypto');
  const earnAssets = portfolio.earnAssets.filter(
    asset => asset.valueUsd === undefined || asset.valueUsd > 0,
  );
  const showLocked = (portfolio.lockedFuse ?? 0) > 0;
  const showEarn = earnAssets.length > 0 || showLocked;
  const showStable = stable.all.length > 0 || portfolio.hasCardBalance;
  const isEmpty = !showStable && !showEarn && crypto.all.length === 0;
  const hasDebt = (portfolio.debt ?? 0) > 0;
  const estimate = yieldEstimate(portfolio.dailyYield, portfolio.monthlyYield);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(path.HOME));

  const openCash = (asset: PortfolioAsset) => {
    // An escrow-only holding has no wallet coin page yet; its position sheet owns it.
    const token = asset.tokens[0];
    if (!asset.heldInWallet) {
      setBorrowOpen(true);
      return;
    }
    router.push(coinAssetPath(token) as Href);
  };
  const openEarn = (asset: EarnAsset) => {
    // The share token's coin page carries APY, networks, Send and history; it links back
    // to Earn for withdrawals. Escrow-only shares belong to the position sheet.
    const token = asset.walletTokens[0];
    if (token) router.push(coinAssetPath(token) as Href);
    else if (asset.backsCredit) setBorrowOpen(true);
    else router.push({ pathname: '/savings', params: { vault: asset.vault.type } } as Href);
  };
  const renderHoldings = (list: HoldingList, kind: HoldingKind) =>
    list.shown.map((asset, index) => {
      const earningVault = getEarningTokenVault(asset.tokens[0]);
      const apy = portfolio.earnAssets.find(
        holding => holding.vault.type === earningVault?.vault.type,
      )?.apy;
      return (
        <Fragment key={`${kind}:${asset.id}`}>
          {index > 0 && <Divider />}
          <AssetRow
            title={asset.symbol}
            value={asset.valueUsd}
            isEarning={!!earningVault}
            apy={apy}
            icon={<PortfolioIcon token={asset.tokens[0]} />}
            subtitle={holdingDetails(asset)}
            onPress={() => openCash(asset)}
          />
        </Fragment>
      );
    });
  const renderSmallToggle = (list: HoldingList, kind: HoldingKind) => {
    if (!list.small.length) return null;
    const isOpen = expanded[kind];
    return (
      <>
        {(list.shown.length > 0 || (kind === 'stable' && portfolio.hasCardBalance)) && <Divider />}
        <Pressable
          onPress={() => setExpanded(value => ({ ...value, [kind]: !value[kind] }))}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} small ${kind === 'stable' ? 'stablecoin' : 'crypto'} balances`}
          accessibilityState={{ expanded: isOpen }}
          className="flex-row items-center justify-center gap-[6px] py-[14px]"
        >
          <Text className="text-[14px] text-white/50">
            {isOpen ? 'Hide' : 'Show'} {list.small.length} small{' '}
            {list.small.length === 1 ? 'balance' : 'balances'}
          </Text>
          <Image
            source={PORTFOLIO_ICONS.down}
            contentFit="contain"
            style={{
              width: 16,
              height: 16,
              transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
            }}
          />
        </Pressable>
      </>
    );
  };

  return (
    <PageLayout
      edges={[]}
      showNavbar={false}
      showsVerticalScrollIndicator={false}
      onRefresh={Platform.OS === 'web' ? undefined : refetchAll}
      refreshing={isRefreshing}
      additionalContent={<BorrowPositionSheet isOpen={borrowOpen} onOpenChange={setBorrowOpen} />}
    >
      <View className="mx-auto w-full max-w-[419px] gap-[24px] px-[16px] pb-[140px] pt-[24px] web:md:max-w-[40rem]">
        <View className="h-[44px] flex-row items-center justify-between px-[2px]">
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-[44px] w-[44px] items-center justify-center rounded-full bg-[#2A2A2A]"
          >
            <Image
              source={PORTFOLIO_ICONS.back}
              style={{ width: 20, height: 20 }}
              contentFit="contain"
            />
          </Pressable>
          <Text className="text-[18px] font-semibold text-white">Assets</Text>
          <View className="h-[44px] w-[44px]" />
        </View>

        <View className="items-center py-[8px]">
          {portfolio.isLoading ? (
            <Skeleton className="h-[84px] w-[220px] rounded-xl" />
          ) : portfolio.totalAssets === undefined ? (
            <View className="items-center gap-[4px] pt-[8px]">
              <Text className="text-[16px] font-medium text-white/70">Total assets</Text>
              <Text className="text-[45px] font-semibold text-white">
                {assetAmountLabel(portfolio.totalAssets)}
              </Text>
            </View>
          ) : (
            <BalanceHeadline
              balance={portfolio.totalAssets}
              label="Total assets"
              mutedDecimals={false}
            />
          )}
          {!portfolio.isLoading && estimate && (
            <View className="pt-[6px]">
              <View className="rounded-full bg-card px-[14px] py-[7px]">
                <Text className="text-[16px] font-normal text-[#94F27F]">
                  +{assetAmountLabel(estimate.amount)} / {estimate.period} est.
                </Text>
              </View>
            </View>
          )}
          {hasDebt && (
            <Text className="pt-[12px] text-center text-[14px] text-white/50">
              Balance {assetAmountLabel(portfolio.netBalance)} after{' '}
              {assetAmountLabel(portfolio.debt)} borrowed
            </Text>
          )}
        </View>

        {portfolio.isError && (
          <View className="gap-[12px] rounded-[20px] bg-card p-[16px]">
            <Text className="text-[14px] text-white/70">
              Some balances or prices are unavailable. Amounts may be incomplete or out of date.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry balances"
              onPress={() => void refetchAll()}
            >
              <Text className="text-[14px] font-medium text-[#94F27F]">Retry</Text>
            </Pressable>
          </View>
        )}

        {portfolio.isLoading ? (
          <>
            {[0, 1, 2].map(index => (
              <Skeleton key={index} className="h-[148px] rounded-[20px]" />
            ))}
          </>
        ) : (
          <>
            {showStable && (
              <Group title="Stablecoins">
                {renderHoldings(stable, 'stable')}
                {portfolio.hasCardBalance && (
                  <>
                    {stable.shown.length > 0 && <Divider />}
                    <AssetRow
                      title="Card balance"
                      icon={<PortfolioIcon kind="card" />}
                      value={portfolio.cardBalance}
                      subtitle="Available on your card"
                      onPress={() => router.push(path.CARD_INFO)}
                    />
                  </>
                )}
                {renderSmallToggle(stable, 'stable')}
              </Group>
            )}

            {showEarn && (
              <Group title="Earn">
                {earnAssets.map((asset, index) => (
                  <Fragment key={asset.vault.type}>
                    {index > 0 && <Divider />}
                    <AssetRow
                      title={asset.vault.vaultToken}
                      value={asset.valueUsd}
                      isEarning
                      apy={asset.apy}
                      icon={
                        <PortfolioIcon
                          token={asset.walletTokens[0]}
                          symbol={asset.vault.vaultToken}
                        />
                      }
                      subtitle={earnDetails(asset).join(' · ')}
                      onPress={() => openEarn(asset)}
                    />
                  </Fragment>
                ))}
                {showLocked && (
                  <>
                    {earnAssets.length > 0 && <Divider />}
                    <AssetRow
                      title="Locked FUSE"
                      isEarning
                      apy={
                        portfolio.earnAssets.find(asset => asset.vault.type === VaultType.FUSE)?.apy
                      }
                      icon={<PortfolioIcon symbol="FUSE" locked />}
                      value={portfolio.lockedTotal}
                      subtitle={lockedFuseDescription(portfolio.lockedFuse, portfolio.nextUnlockAt)}
                      detail="Still earning"
                      onPress={() => router.push(path.REWARDS)}
                    />
                  </>
                )}
              </Group>
            )}

            {crypto.all.length > 0 && (
              <Group title="Crypto">
                {renderHoldings(crypto, 'crypto')}
                {renderSmallToggle(crypto, 'crypto')}
              </Group>
            )}

            {isEmpty && (
              <View className="rounded-[20px] bg-card p-[16px]">
                <Text className="text-[14px] text-white/60">No assets yet</Text>
              </View>
            )}

            {hasDebt && (
              <Group title="Credit">
                <AssetRow
                  title="Borrowed"
                  icon={<PortfolioIcon kind="card" />}
                  value={-portfolio.debt!}
                  subtitle={
                    !portfolio.creditDetailsAvailable
                      ? 'Credit details unavailable'
                      : figures.isLoading
                        ? 'Loading credit details'
                        : `${figures.borrowApy} APY · ${figures.availableToBorrow.replace(/\.00$/, '')} left to spend`
                  }
                  detail={portfolio.creditDetailsAvailable ? 'Repay' : undefined}
                  onPress={portfolio.creditDetailsAvailable ? () => setBorrowOpen(true) : undefined}
                />
              </Group>
            )}

            {bankBalances.length > 0 && (
              <View className="gap-[12px]">
                <Text className="px-[4px] text-[16px] text-white/50">Bank balances</Text>
                <View className="overflow-hidden rounded-[20px] bg-card">
                  {bankBalances.map((balance, index) => (
                    <Fragment key={balance.tokenSymbol}>
                      {index > 0 && <Divider />}
                      <Pressable
                        onPress={() => router.push(path.BANK_TRANSFER)}
                        accessibilityRole="button"
                        className="flex-row justify-between p-[16px]"
                      >
                        <Text className="text-[16px] font-semibold">{balance.currency}</Text>
                        <Text className="text-[16px] font-semibold">
                          {formatNumber(balance.amount, 2)} {balance.currency}
                        </Text>
                      </Pressable>
                    </Fragment>
                  ))}
                </View>
                <Text className="text-[13px] text-white/40">
                  Bank balances are shown in their own currency and excluded from the USD total.
                </Text>
              </View>
            )}
          </>
        )}
        <Text className="text-[13px] font-normal text-white/40">
          Tap an asset for details. Values in USD; APY is variable. Yield is an estimate.
        </Text>
      </View>
    </PageLayout>
  );
}

export default function AssetsScreen() {
  const insets = useSafeAreaInsets();
  const portfolio = usePortfolio();
  const figures = useSpendModeFigures();
  const { refetchAll, isRefreshing } = useActivityRefresh();
  const { balances } = useWirexUnifiedBalances();
  // Use the known insets on the first frame. Native SafeAreaView can apply its
  // padding after the Android opening transition and shift the entire page.
  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
      }}
    >
      <AssetsOverview
        portfolio={portfolio}
        figures={figures}
        bankBalances={bankBalancesToShow(balances)}
        refetchAll={refetchAll}
        isRefreshing={isRefreshing}
      />
    </View>
  );
}
