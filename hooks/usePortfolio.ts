import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Address, formatUnits, zeroAddress } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useNativePriceQuery } from '@/hooks/useNativePriceUsd';
import { usePortfolioCustody } from '@/hooks/usePortfolioCustody';
import { useTierMembership } from '@/hooks/useTierMembership';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import {
  bridgedShareValues,
  cashValue,
  groupPortfolioCash,
  portfolioTotals,
  portfolioVaultType,
  savingsUsdValue,
  sumKnownValues,
  sumPortfolioValues,
  vaultShareHoldings,
} from '@/lib/portfolio';
import { refreshAccountQueries } from '@/lib/refreshAccountQueries';
import { VaultType } from '@/lib/types';
import { hasCard } from '@/lib/utils';
import { cardHoldsBalance } from '@/lib/utils/cardHelpers';

const CREDIT_MODULES = [
  ...new Set(
    [ADDRESSES.fuse.cashModuleV2, ...ADDRESSES.fuse.retiredCashModulesV2].filter(
      address => address.toLowerCase() !== zeroAddress,
    ),
  ),
];

/** One reconciled model for the home summary and the full Assets screen. */
export function usePortfolio() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const wallet = useWalletTokens();
  const savings = useTotalSavingsUSD();
  const membership = useTierMembership();
  const registration = useCardSpendRegistration();
  const cardStatus = useCardStatus();
  const cardDetails = useCardDetails();
  const { provider } = useCardProvider();
  const userHasCard = hasCard(cardStatus.data);
  const cardHasOwnBalance = cardHoldsBalance(provider);
  const creditDetailsAvailable = !!registration.position && !registration.readError;
  const hasCardBalance =
    cardHasOwnBalance && (userHasCard || Number(cardDetails.data?.balances.available?.amount) > 0);
  const usdApy = useMaxAPY(VaultType.USDC);
  const fuseApy = useMaxAPY(VaultType.FUSE);
  const ethApy = useMaxAPY(VaultType.ETH);
  const custody = usePortfolioCustody({
    userId: user?.userId,
    safeAddress: user?.safeAddress as Address | undefined,
    // Unknown (undefined) until membership loads; null when the user has no lock. Uses the
    // membership's pinned contract, so positions on an older lock are still found.
    lockAddress: membership.data
      ? ((membership.data.lock.lockAddress as Address | null) ?? null)
      : undefined,
    // Custody survives module revocation and does not depend on the spending feature flag.
    creditModules: CREDIT_MODULES,
  });
  const lockedFuse = custody.locked.data;
  const credit = custody.credit.data;
  const exactSavings = savings.exactValuesByVault;
  const fusePrice = useNativePriceQuery(
    fuse.id,
    'fusePriceUsd',
    (lockedFuse ?? 0) > 0 || (exactSavings?.[VaultType.FUSE] ?? 0) > 0,
  );
  const ethPrice = useNativePriceQuery(
    mainnet.id,
    'ethPriceUsd',
    (exactSavings?.[VaultType.ETH] ?? 0) > 0,
  );

  const model = useMemo(() => {
    const collateral = (credit?.collateral ?? []).map(token => {
      const walletToken = wallet.tokens.find(
        item =>
          item.chainId === token.chainId &&
          item.contractAddress.toLowerCase() === token.contractAddress.toLowerCase(),
      );
      return {
        ...walletToken,
        ...token,
        commonId: walletToken?.commonId,
        logoUrl: walletToken?.logoUrl,
      };
    });
    const bridged = bridgedShareValues(wallet.tokens);
    const apys = { [VaultType.USDC]: usdApy, [VaultType.FUSE]: fuseApy, [VaultType.ETH]: ethApy };

    // Each vault: savings on its own networks + shares bridged elsewhere + shares escrowed as
    // credit collateral. An unknown part leaves the vault showing what is known, flagged.
    const earnAssets = VAULTS.map(vault => {
      const heldCollateral = collateral.filter(
        token => portfolioVaultType(token.contractAddress, token.chainId) === vault.type,
      );
      const escrowedValue = !credit
        ? undefined
        : sumPortfolioValues(
            heldCollateral.map(token =>
              savingsUsdValue(
                Number(formatUnits(BigInt(token.balance), token.contractDecimals)),
                token.quoteRate,
              ),
            ),
          );
      const parts = sumKnownValues([
        exactSavings?.[vault.type],
        vault.type in bridged ? bridged[vault.type] : 0,
        escrowedValue,
      ]);
      const apy = apys[vault.type];
      const price =
        vault.type === VaultType.ETH
          ? Number(ethPrice.data)
          : vault.type === VaultType.FUSE
            ? Number(fusePrice.data)
            : 1;
      const valueUsd = parts.total;
      return {
        vault,
        valueUsd,
        ...vaultShareHoldings(wallet.tokens, collateral, vault.type),
        isComplete: parts.complete,
        underlyingAmount: valueUsd !== undefined && price > 0 ? valueUsd / price : undefined,
        backsCredit: heldCollateral.length > 0,
        apy: !apy.isAPYsLoading && apy.maxAPY > 0 ? apy.maxAPY : undefined,
      };
    });
    const earn = sumKnownValues(earnAssets.map(asset => asset.valueUsd));
    const earnComplete = earn.complete && earnAssets.every(asset => asset.isComplete);

    const cashAssets = groupPortfolioCash(wallet.tokens, collateral);
    const walletUnavailable = !!wallet.error && wallet.tokens.length === 0;
    const cash = cashValue(cashAssets);
    const cashTotal = walletUnavailable ? undefined : cash.total;
    const cashComplete =
      !walletUnavailable &&
      !wallet.error &&
      wallet.failedChainIds.length === 0 &&
      cash.unpricedCount === 0;

    const lockedTotal =
      lockedFuse === undefined ? undefined : savingsUsdValue(lockedFuse, Number(fusePrice.data));
    const ownCardBalance = hasCardBalance ? cardDetails.data?.balances.available?.amount : '0';
    const cardBalance =
      ownCardBalance !== undefined && Number.isFinite(Number(ownCardBalance))
        ? Number(ownCardBalance)
        : undefined;
    const hasIncompleteCard = cardStatus.isError || (cardHasOwnBalance && cardDetails.isError);
    const debt = credit?.debtUsd;
    const totals = portfolioTotals({
      earn: earn.total,
      locked: lockedTotal,
      cash: cashTotal,
      card: hasIncompleteCard ? undefined : cardBalance,
      debt,
      complete: earnComplete && cashComplete,
    });

    // An estimate from APY, not a measured change since midnight, over the parts we know.
    // Locked FUSE is soFUSE in the lock, so it earns the FUSE vault rate.
    const periodYield = (periodsPerYear: number) => {
      const rate = (apy: number | undefined) =>
        apy === undefined ? 0 : Math.pow(1 + apy / 100, 1 / periodsPerYear) - 1;
      return (
        earnAssets.reduce((sum, asset) => sum + (asset.valueUsd ?? 0) * rate(asset.apy), 0) +
        (lockedTotal ?? 0) *
          rate(!fuseApy.isAPYsLoading && fuseApy.maxAPY > 0 ? fuseApy.maxAPY : undefined)
      );
    };
    const dailyYield = periodYield(365);
    // Shown instead of the daily figure when that rounds below a cent.
    const monthlyYield = periodYield(12);

    return {
      cashAssets,
      cashTotal,
      unpricedCashCount: cash.unpricedCount,
      earnAssets,
      earnTotal: earn.total,
      lockedFuse,
      lockedTotal,
      cardBalance,
      debt,
      dailyYield,
      monthlyYield,
      ...totals,
    };
  }, [
    credit,
    wallet.tokens,
    wallet.error,
    wallet.failedChainIds,
    exactSavings,
    usdApy,
    fuseApy,
    ethApy,
    lockedFuse,
    fusePrice.data,
    ethPrice.data,
    hasCardBalance,
    cardHasOwnBalance,
    cardDetails.data,
    cardDetails.isError,
    cardStatus.isError,
  ]);

  const isLoading =
    wallet.isLoading ||
    savings.isLoading ||
    membership.isLoading ||
    custody.credit.isLoading ||
    custody.locked.isLoading ||
    ((lockedFuse ?? 0) > 0 && fusePrice.isLoading) ||
    cardStatus.isLoading ||
    (cardHasOwnBalance && cardDetails.isLoading);
  // "Some balances are unavailable": anything missing, unpriced or stale. Drives the banner and
  // the incomplete marker; it never replaces the figures that did load.
  const isError =
    !isLoading &&
    (!model.isComplete ||
      membership.isError ||
      ((lockedFuse ?? 0) > 0 && fusePrice.isError) ||
      ((model.debt ?? 0) > 0 && !creditDetailsAvailable));
  const refresh = useCallback(
    () =>
      user?.safeAddress
        ? refreshAccountQueries(queryClient, user.userId, user.safeAddress, true)
        : Promise.resolve(),
    [queryClient, user?.userId, user?.safeAddress],
  );
  return {
    ...model,
    isLoading,
    isError,
    refresh,
    nextUnlockAt: membership.data?.lock.nextUnlockAt,
    hasCardBalance,
    creditDetailsAvailable,
  };
}
