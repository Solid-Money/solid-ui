import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Href, router, useLocalSearchParams } from 'expo-router';

import BorrowPositionSheet from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheet';
import { interestOverPastDays } from '@/components/Earn/earnPortfolio';
import PageLayout from '@/components/PageLayout';
import { VaultKey } from '@/constants/withdraw';
import { useAPYs, useMaxAPY } from '@/hooks/useAnalytics';
import { usePortfolio } from '@/hooks/usePortfolio';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useSavingsVaults } from '@/hooks/useSavingsVaults';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { useVaultInterestEarned } from '@/hooks/useVaultInterestEarned';
import { coinAssetPath, sumKnownValues } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { getEarningTokenVault } from '@/lib/vaults';

import { isVaultType } from './vaultDeepLink';
import { hasSelectedVaultFunds } from './vaultFunding';
import YieldHowItWorksSheet from './YieldHowItWorksSheet';
import YieldProductView from './YieldProductView';

const VAULT_KEY_BY_TYPE: Record<VaultType, VaultKey> = {
  [VaultType.USDC]: 'USD',
  [VaultType.FUSE]: 'FUSE',
  [VaultType.ETH]: 'ETH',
};

/**
 * The product page reached from Home, Assets and Earn: USD Yield, ETH Yield or FUSE Yield
 * (Figma 28443:4811 funded, 28501:5004 no funds). The balance is the product's; the share
 * token it is held as (soUSD…) is shown in its own card and opens its coin page.
 */
export default function SavingsScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.SAVINGS_SCREEN });
  const insets = useSafeAreaInsets();

  const { vault: vaultParam } = useLocalSearchParams<{ vault?: string }>();
  const vaultType = isVaultType(vaultParam) ? vaultParam : VaultType.USDC;
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCreditOpen, setIsCreditOpen] = useState(false);

  const portfolio = usePortfolio();
  const { valuesByVault, isLoading: isSavingsLoading } = useTotalSavingsUSD();
  const { vaults: walletVaults, isLoading: isWalletVaultsLoading } = useSavingsVaults();
  const { maxAPY, isAPYsLoading } = useMaxAPY(vaultType);
  const { data: apys } = useAPYs(vaultType);
  const interest = useVaultInterestEarned(vaultType);
  const walletVault = walletVaults.find(item => item.key === VAULT_KEY_BY_TYPE[vaultType]);
  const asset = portfolio.earnAssets.find(item => item.vault.type === vaultType);

  // Shares the savings reads don't cover — a production soUSD seen from a development
  // build — arrive as wallet tokens. They are still this product, as Home shows them.
  const unreadShares = portfolio.cashAssets.filter(
    item => getEarningTokenVault(item.tokens[0])?.vault.type === vaultType,
  );
  const unreadUsd = sumKnownValues(unreadShares.map(item => item.valueUsd)).total ?? 0;
  const unreadAmount = unreadShares.reduce((sum, item) => sum + item.balance, 0);

  // The product's balance counts its shares wherever they are: on any network, or backing
  // the card.
  const balanceUsd =
    Math.max(asset?.valueUsd ?? 0, valuesByVault?.[vaultType] ?? 0, walletVault?.balanceUSD ?? 0) +
    unreadUsd;
  const isLoading =
    isSavingsLoading || isWalletVaultsLoading || valuesByVault === undefined || portfolio.isLoading;
  const isFunded =
    balanceUsd > 0 ||
    hasSelectedVaultFunds(valuesByVault, vaultType, Boolean(walletVault?.tokens.length));

  // Shares are valued at the product's own price per share, so the two rows add up to it.
  const shareAmount = asset?.shareAmount ?? 0;
  const usdPerShare = shareAmount > 0 && asset?.valueUsd ? asset.valueUsd / shareAmount : undefined;
  const walletShareAmount = asset?.walletShareAmount ?? 0;
  const escrowedShares = asset?.escrowedShareAmount ?? 0;
  const walletToken = asset?.walletTokens[0] ?? unreadShares[0]?.tokens[0];

  // Read from the 30-day APY (see interestOverPastDays). Capped at the interest earned since
  // the first deposit, except for shares that calculation can't see (a production soUSD on
  // a development build), where the cap would wrongly be zero.
  const past30Usd =
    isAPYsLoading || (interest.isLoading && unreadUsd === 0)
      ? undefined
      : interestOverPastDays(
          balanceUsd,
          apys?.thirtyDay || maxAPY,
          30,
          unreadUsd > 0 ? undefined : interest.interestUsd,
        );

  return (
    <PageLayout
      showNavbar={false}
      edges={['right', 'left', 'bottom']}
      additionalContent={
        <>
          <YieldHowItWorksSheet
            vaultType={vaultType}
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />
          <BorrowPositionSheet isOpen={isCreditOpen} onOpenChange={setIsCreditOpen} />
        </>
      }
    >
      <YieldProductView
        vaultType={vaultType}
        topInset={insets.top + 16}
        isLoading={isLoading}
        isFunded={isFunded}
        balanceUsd={balanceUsd}
        apy={isAPYsLoading || !maxAPY ? undefined : maxAPY}
        interestUsd={interest.interestUsd}
        isInterestLoading={interest.isLoading}
        past30Usd={past30Usd}
        walletShares={walletShareAmount + unreadAmount}
        walletUsd={
          usdPerShare === undefined && walletShareAmount > 0
            ? undefined
            : walletShareAmount * (usdPerShare ?? 0) + unreadUsd
        }
        escrowedShares={escrowedShares}
        escrowedUsd={usdPerShare === undefined ? undefined : escrowedShares * usdPerShare}
        debtUsd={portfolio.debt}
        exchangeRate={interest.exchangeRate}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenWallet={
          walletToken ? () => router.push(coinAssetPath(walletToken) as Href) : undefined
        }
        onOpenCredit={portfolio.creditDetailsAvailable ? () => setIsCreditOpen(true) : undefined}
      />
    </PageLayout>
  );
}
