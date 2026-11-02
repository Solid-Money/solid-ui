import { useState } from 'react';
import { Href, router } from 'expo-router';

import EarnYieldBoostCard from '@/components/Earn/EarnYieldBoostCard';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import PageLayout from '@/components/PageLayout';
import SavingsHelpModal from '@/components/Savings/NewSavings/SavingsHelpModal';
import { isStockVaultType } from '@/constants/stockVaults';
import { useAPYsByAsset, useMaxAPY, useMaxAPYs } from '@/hooks/useAnalytics';
import { useDepositsOnItsWay } from '@/hooks/useDepositsOnItsWay';
import { usePortfolio } from '@/hooks/usePortfolio';
import { isVaultOffered, useStockVaultsAccess } from '@/hooks/useStockVaultsAccess';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { useVaultInterestEarned } from '@/hooks/useVaultInterestEarned';
import { sumKnownValues } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { findVault } from '@/lib/vaults';

import {
  interestOverPastDays,
  resolveVaultApy,
  weightedApy,
  type YieldHolding,
  yieldHoldings,
} from './earnPortfolio';
import EarnView, { type EarnProduct } from './EarnView';
import { useVaultDetailPrefetch } from './useVaultDetailPrefetch';
import { openYieldProduct } from './yieldProducts';

/** A stock vault has no deposit history to work its interest out from yet: none is shown. */
const NO_INTEREST = { interestUsd: 0, isLoading: false };

/**
 * The Earn tab: Figma 28551:5563 (funded) and 28551:5695 (nothing deposited). This
 * container reads the data; `EarnView` lays it out.
 */
export default function EarnScreen() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  useVaultDetailPrefetch();
  const portfolio = usePortfolio();
  const { deposits: depositsOnItsWay, amountOnItsWay } = useDepositsOnItsWay();
  // soEURC, in euros, apart from every dollar figure below (see lib/vaultCurrency).
  const { eurValue, eurShares, isEurLoading } = useTotalSavingsUSD();
  const eurRate = useMaxAPY(VaultType.EUR);

  const rates = useMaxAPYs();
  const { data: apysByAsset } = useAPYsByAsset();
  const coreInterest = {
    [VaultType.USDC]: useVaultInterestEarned(VaultType.USDC),
    [VaultType.ETH]: useVaultInterestEarned(VaultType.ETH),
    [VaultType.FUSE]: useVaultInterestEarned(VaultType.FUSE),
  };
  const interestOf = (type: YieldHolding['type']) =>
    isStockVaultType(type) ? NO_INTEREST : coreInterest[type];
  const thirtyDayOf = (type: YieldHolding['type']) => apysByAsset?.[type]?.thirtyDay;
  const { isEnabled: isStockVaultsEnabled } = useStockVaultsAccess();

  const isLoading = portfolio.isLoading;
  const areRatesLoading = rates[VaultType.USDC].isAPYsLoading;
  // The reported rate, or the product's indicative one while analytics has none.
  const apyOf = (type: YieldHolding['type']) => resolveVaultApy(type, rates[type].maxAPY);

  // Shares count wherever they are, a production share on a development build included.
  // A stock vault is listed for users it is offered to, and for anyone holding it.
  const holdings = yieldHoldings(portfolio.earnAssets, portfolio.cashAssets).filter(
    holding =>
      isVaultOffered(holding.type, isStockVaultsEnabled) ||
      holding.shareAmount > 0 ||
      (holding.valueUsd ?? 0) > 0,
  );
  // Locked FUSE is soFUSE in the tier lock, still earning FUSE Yield's rate, so it is part
  // of FUSE Yield and of the total (Figma: "10,000 FUSE locked" on the FUSE Yield row).
  const lockedFuse = (portfolio.lockedFuse ?? 0) > 0 ? portfolio.lockedFuse : undefined;
  const usdProducts: EarnProduct[] = holdings.map(holding => {
    const isLocked = holding.type === VaultType.FUSE && lockedFuse !== undefined;
    return {
      type: holding.type,
      valueUsd: isLocked
        ? sumKnownValues([holding.valueUsd, portfolio.lockedTotal]).total
        : holding.valueUsd,
      shareAmount: holding.shareAmount,
      underlyingAmount: holding.underlyingAmount,
      lockedFuse: isLocked ? lockedFuse : undefined,
      onItsWayUsd: holding.type === VaultType.USDC ? amountOnItsWay : undefined,
      apy: apyOf(holding.type),
      isApyLoading: rates[holding.type].isAPYsLoading,
    };
  });

  // The headline, the rate chip and the interest stats are dollar figures: they cover the
  // USD-valued products only. soEURC is held in EUR and never converted into them.
  // TODO(soEURC): decide whether the Earn headline shows the EUR balance as its own € line.
  const total = isLoading
    ? undefined
    : sumKnownValues(usdProducts.map(item => item.valueUsd)).total;
  const isFunded = (total ?? 0) > 0;
  const apyLabel = areRatesLoading
    ? undefined
    : isFunded
      ? `${weightedApy(usdProducts.map(item => ({ valueUsd: item.valueUsd, apy: item.apy ?? 0 }))).toFixed(1)}% avg APY`
      : `Up to ${Math.max(...usdProducts.map(item => item.apy ?? 0)).toFixed(1)}% APY`;

  // EUR Yield: its own row, valued in euros, then each stock vault's — in dollars, so
  // in the figures above too, but listed after the established products.
  const products: EarnProduct[] = [
    ...usdProducts.filter(product => !isStockVaultType(product.type)),
    {
      type: VaultType.EUR,
      valueUsd: undefined,
      valueEur: isEurLoading ? undefined : eurValue,
      shareAmount: eurShares ?? 0,
      apy: resolveVaultApy(VaultType.EUR, eurRate.maxAPY),
      isApyLoading: eurRate.isAPYsLoading,
    },
    ...usdProducts.filter(product => isStockVaultType(product.type)),
  ];

  // Interest is read per product; a product with nothing in it has nothing to wait for.
  const funded = holdings.filter(holding => (holding.valueUsd ?? 0) > 0);
  const totalEarned = funded.some(holding => interestOf(holding.type).isLoading)
    ? undefined
    : funded.reduce((sum, holding) => sum + interestOf(holding.type).interestUsd, 0);

  // Read from each product's 30-day APY (see interestOverPastDays), capped at what it has
  // earned since the first deposit, except for shares that calculation can't see. The lock
  // has no deposit history here, so it isn't capped.
  const past30 =
    areRatesLoading ||
    funded.some(holding => holding.unreadUsd === 0 && interestOf(holding.type).isLoading)
      ? undefined
      : funded.reduce(
          (sum, holding) =>
            sum +
            interestOverPastDays(
              holding.valueUsd ?? 0,
              thirtyDayOf(holding.type) || rates[holding.type].maxAPY,
              30,
              holding.unreadUsd > 0 ? undefined : interestOf(holding.type).interestUsd,
            ),
          0,
        ) +
        interestOverPastDays(
          lockedFuse === undefined ? 0 : (portfolio.lockedTotal ?? 0),
          thirtyDayOf(VaultType.FUSE) || rates[VaultType.FUSE].maxAPY,
        );

  return (
    <PageLayout
      mobileTitle={null}
      mobileHeaderRightAction="help"
      onMobileHeaderHelpPress={() => setIsHelpOpen(true)}
      desktopHeaderRightAction={
        <HeaderHelpButton accessibilityLabel="How Earn works" onPress={() => setIsHelpOpen(true)} />
      }
      additionalContent={
        <SavingsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      }
    >
      <EarnView
        isLoading={isLoading}
        total={total}
        apyLabel={apyLabel}
        totalEarned={totalEarned}
        past30={past30}
        products={products}
        onOpenProduct={type => router.push(openYieldProduct(type) as Href)}
        boost={<EarnYieldBoostCard />}
        depositsOnItsWay={depositsOnItsWay}
      />
    </PageLayout>
  );
}
