import { Fragment, ReactNode, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { EyeOff } from 'lucide-react-native';

import AssetRow, { assetAmountLabel, HIDDEN_AMOUNT } from '@/components/Assets/AssetRow';
import PortfolioIcon, {
  PORTFOLIO_ICONS,
  PortfolioIconKind,
} from '@/components/Assets/PortfolioIcon';
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
import { cashGroupTotal, coinAssetPath, PortfolioAsset, splitSmallBalances } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import type { BankBalance } from '@/components/Home/NewHome/OtherBalancesDropdown/balanceTotals';

const Divider = () => <View className="h-px bg-[#2A2A2A]" />;
const Group = ({
  title,
  total,
  hidden,
  children,
}: {
  title: string;
  total: number | undefined;
  hidden: boolean;
  children: ReactNode;
}) => (
  <View className="gap-[12px]">
    <View className="flex-row items-center justify-between px-[4px]">
      <Text className="text-[16px] font-normal text-white/50">{title}</Text>
      <Text className="text-[16px] font-medium text-white/85">
        {assetAmountLabel(total, hidden)}
      </Text>
    </View>
    <View className="overflow-hidden rounded-[20px] bg-card">{children}</View>
  </View>
);
const cashIcon = (asset: PortfolioAsset): PortfolioIconKind | undefined => {
  // Dynamic token imagery stays dynamic. These three known symbols use the design's icons.
  if (asset.symbol === 'USDC') return 'usdc';
  if (asset.symbol === 'ETH') return 'eth';
  if (asset.symbol === 'FUSE') return 'fuse';
  return undefined;
};

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
  const [hidden, setHidden] = useState(false);
  const [showSmall, setShowSmall] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const { visible, small } = splitSmallBalances(portfolio.cashAssets);
  const cashAssets = showSmall ? portfolio.cashAssets : visible;
  const earnAssets = portfolio.earnAssets.filter(
    asset => asset.valueUsd === undefined || asset.valueUsd > 0,
  );
  const hasDebt = (portfolio.debt ?? 0) > 0;
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

  return (
    <PageLayout
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
          <Pressable
            onPress={() => setHidden(value => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
            className="h-[44px] w-[44px] items-center justify-center rounded-full bg-[#2A2A2A]"
          >
            {hidden ? (
              <EyeOff color="white" size={20} />
            ) : (
              <Image
                source={PORTFOLIO_ICONS.eye}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
            )}
          </Pressable>
        </View>

        <View className="items-center py-[8px]">
          {portfolio.isLoading ? (
            <Skeleton className="h-[84px] w-[220px] rounded-xl" />
          ) : hidden || portfolio.totalAssets === undefined ? (
            <View className="items-center gap-[4px] pt-[8px]">
              <Text className="text-[16px] font-medium text-white/70">Total assets</Text>
              <Text className="text-[45px] font-semibold text-white">
                {assetAmountLabel(portfolio.totalAssets, hidden)}
              </Text>
            </View>
          ) : (
            <BalanceHeadline
              balance={portfolio.totalAssets}
              label="Total assets"
              mutedDecimals={false}
            />
          )}
          {!portfolio.isLoading &&
            portfolio.dailyYield !== undefined &&
            portfolio.dailyYield > 0 && (
              <View className="pt-[6px]">
                <View className="rounded-full bg-card px-[14px] py-[7px]">
                  <Text className="text-[16px] font-normal text-[#94F27F]">
                    {hidden ? HIDDEN_AMOUNT : `+${assetAmountLabel(portfolio.dailyYield)}`} / day
                    est.
                  </Text>
                </View>
              </View>
            )}
          {hasDebt && (
            <Text className="pt-[12px] text-center text-[14px] text-white/50">
              Balance {assetAmountLabel(portfolio.netBalance, hidden)} after{' '}
              {assetAmountLabel(portfolio.debt, hidden)} borrowed
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
            {earnAssets.length > 0 && (
              <Group title="Earn" total={portfolio.earnTotal} hidden={hidden}>
                {earnAssets.map((asset, index) => (
                  <Fragment key={asset.vault.type}>
                    {index > 0 && <Divider />}
                    <AssetRow
                      title={asset.vault.vaultName ?? `${asset.vault.type} Yield`}
                      value={asset.valueUsd}
                      hidden={hidden}
                      icon={
                        <PortfolioIcon
                          kind={
                            asset.vault.type === VaultType.USDC
                              ? 'usd'
                              : asset.vault.type === VaultType.ETH
                                ? 'eth'
                                : 'fuse'
                          }
                        />
                      }
                      subtitle={
                        <>
                          {asset.apy !== undefined && (
                            <Text className="text-[#94F27F]">{asset.apy.toFixed(1)}% APY</Text>
                          )}
                          {asset.backsCredit
                            ? `${asset.apy !== undefined ? ' · ' : ''}backs your credit`
                            : asset.vault.type !== VaultType.USDC &&
                                asset.underlyingAmount !== undefined
                              ? `${asset.apy !== undefined ? ' · ' : ''}${hidden ? HIDDEN_AMOUNT : formatNumber(asset.underlyingAmount, asset.vault.type === VaultType.ETH ? 4 : 2)} ${asset.vault.type.toUpperCase()}`
                              : ''}
                        </>
                      }
                      onPress={() =>
                        router.push({
                          pathname: '/savings',
                          params: { vault: asset.vault.type },
                        } as Href)
                      }
                    />
                  </Fragment>
                ))}
              </Group>
            )}

            {(portfolio.lockedFuse ?? 0) > 0 && (
              <Group title="Locked" total={portfolio.lockedTotal} hidden={hidden}>
                <AssetRow
                  title="Locked FUSE"
                  icon={<PortfolioIcon kind="fuse" locked />}
                  value={portfolio.lockedTotal}
                  hidden={hidden}
                  subtitle={
                    hidden
                      ? HIDDEN_AMOUNT
                      : lockedFuseDescription(portfolio.lockedFuse, portfolio.nextUnlockAt)
                  }
                  detail="Still earning"
                  onPress={() => router.push(path.REWARDS)}
                />
              </Group>
            )}

            <Group
              title="Cash"
              total={cashGroupTotal(portfolio.cashTotal, portfolio.cardBalance)}
              hidden={hidden}
            >
              {cashAssets.map((asset, index) => (
                <Fragment key={asset.id}>
                  {index > 0 && <Divider />}
                  <AssetRow
                    title={asset.symbol === 'ETH' ? 'Ethereum' : asset.symbol}
                    value={asset.valueUsd}
                    hidden={hidden}
                    icon={<PortfolioIcon kind={cashIcon(asset)} token={asset.tokens[0]} />}
                    subtitle={
                      <>
                        {hidden
                          ? HIDDEN_AMOUNT
                          : `${formatNumber(asset.balance, asset.symbol === 'ETH' && asset.balance >= 0.0001 ? 4 : 8, asset.symbol === 'USDC' ? 2 : 0)} ${asset.symbol}`}
                        {asset.networkCount > 1 ? ` · ${asset.networkCount} networks` : ''}
                        {asset.valueUsd === undefined ? ' · no price' : ''}
                        {asset.backsCredit ? ' · backs your credit' : ''}
                      </>
                    }
                    onPress={() => openCash(asset)}
                  />
                </Fragment>
              ))}
              {portfolio.hasCardBalance && (
                <>
                  {cashAssets.length > 0 && <Divider />}
                  <AssetRow
                    title="Card balance"
                    icon={<PortfolioIcon kind="card" />}
                    value={portfolio.cardBalance}
                    hidden={hidden}
                    subtitle="Available on your card"
                    onPress={() => router.push(path.CARD_INFO)}
                  />
                </>
              )}
              {small.length > 0 && (
                <>
                  {(cashAssets.length > 0 || portfolio.hasCardBalance) && <Divider />}
                  <Pressable
                    onPress={() => setShowSmall(value => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showSmall }}
                    className="flex-row items-center justify-center gap-[6px] py-[14px]"
                  >
                    <Text className="text-[14px] text-white/50">
                      {showSmall ? 'Hide' : 'Show'} {small.length} small{' '}
                      {small.length === 1 ? 'balance' : 'balances'}
                    </Text>
                    <Image
                      source={PORTFOLIO_ICONS.down}
                      contentFit="contain"
                      style={{
                        width: 16,
                        height: 16,
                        transform: [{ rotate: showSmall ? '180deg' : '0deg' }],
                      }}
                    />
                  </Pressable>
                </>
              )}
              {!portfolio.cashAssets.length && !portfolio.hasCardBalance && (
                <Text className="p-[16px] text-[14px] text-white/60">No cash balances</Text>
              )}
            </Group>

            {hasDebt && (
              <Group title="Credit" total={-portfolio.debt!} hidden={hidden}>
                <AssetRow
                  title="Borrowed"
                  icon={<PortfolioIcon kind="card" />}
                  value={-portfolio.debt!}
                  hidden={hidden}
                  subtitle={
                    !portfolio.creditDetailsAvailable
                      ? 'Credit details unavailable'
                      : figures.isLoading
                        ? 'Loading credit details'
                        : `${figures.borrowApy} APY · ${hidden ? HIDDEN_AMOUNT : figures.availableToBorrow.replace(/\.00$/, '')} left to spend`
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
                          {hidden
                            ? HIDDEN_AMOUNT
                            : `${formatNumber(balance.amount, 2)} ${balance.currency}`}
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
          Tap an asset for details. Values in USD; APY is variable. Daily yield is an estimate.
        </Text>
      </View>
    </PageLayout>
  );
}

export default function AssetsScreen() {
  const portfolio = usePortfolio();
  const figures = useSpendModeFigures();
  const { refetchAll, isRefreshing } = useActivityRefresh();
  const { balances } = useWirexUnifiedBalances();
  return (
    <AssetsOverview
      portfolio={portfolio}
      figures={figures}
      bankBalances={bankBalancesToShow(balances)}
      refetchAll={refetchAll}
      isRefreshing={isRefreshing}
    />
  );
}
