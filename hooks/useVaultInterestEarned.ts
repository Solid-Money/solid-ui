import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { useAPYs, useLatestTokenTransfer, useUserTransactions } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useNativePriceUsd } from '@/hooks/useNativePriceUsd';
import { useSavingsSummary } from '@/hooks/useSavingsSummary';
import { useSavingsYield } from '@/hooks/useSavingsYield';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { ADDRESSES } from '@/lib/config';
import { SavingMode, VaultType } from '@/lib/types';

/**
 * Interest one vault has earned for the user since their first deposit, in USD.
 *
 * The same figure the vault page has always shown as "Total Rewards": soUSD and soETH
 * work it out from the deposit history, soFUSE from the backend summary (it has no usable
 * transfer history), and FUSE / ETH are priced live.
 */
export const useVaultInterestEarned = (vaultType: VaultType) => {
  const { user } = useUser();
  const vault = VAULTS.find(item => item.type === vaultType) ?? VAULTS[0];
  const { data: balance, isLoading: isBalanceLoading } = useVaultBalance(
    user?.safeAddress as Address,
    vault,
  );
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);
  const { data: apys, isLoading: isApyLoading } = useAPYs(vault.type);
  const { data: lastTimestamp, isLoading: isTimestampLoading } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    vault.name === 'USDC'
      ? ADDRESSES.fuse.vault
      : vault.name === 'ETH'
        ? ADDRESSES.fuse.soEthVault
        : ADDRESSES.fuse.fuseVault,
  );
  const { data: transactions, isLoading: isTransactionsLoading } = useUserTransactions(
    user?.safeAddress,
    vault.type,
  );
  const { firstDepositTimestamp } = useDepositCalculations(
    transactions,
    balance,
    lastTimestamp,
    vault.decimals,
  );
  const { data: savingsSummary, isLoading: isSummaryLoading } = useSavingsSummary(
    vault.name,
    vault.name === 'FUSE',
  );

  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', vault.name === 'FUSE');
  const ethPriceUsd = useNativePriceUsd(mainnet.id, 'ethPriceUsd', vault.name === 'ETH');
  const priceUsd = vault.name === 'USDC' ? 1 : vault.name === 'FUSE' ? fusePriceUsd : ethPriceUsd;
  const vaultApy =
    apys?.allTime != null && Number.isFinite(Number(apys.allTime)) ? Number(apys.allTime) : 0;

  const interestInVaultCurrency = useSavingsYield({
    balance: balance ?? 0,
    apy: vaultApy,
    lastTimestamp: firstDepositTimestamp ?? 0,
    mode: SavingMode.CURRENT,
    decimals: vault.decimals,
    userDepositTransactions: transactions,
    exchangeRate,
    tokenAddress: vault.vaults[0].address,
    inputsReady: !isApyLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0),
    summary: savingsSummary,
    vault: vault.name,
  });

  // An empty vault has earned nothing and needs no price to say so.
  const hasBalance = (balance ?? 0) > 0;
  const isNativePriceLoading = hasBalance && vault.name !== 'USDC' && priceUsd <= 0;
  const isLoading =
    isBalanceLoading ||
    (hasBalance &&
      (isApyLoading ||
        isNativePriceLoading ||
        (vault.name === 'FUSE' ? isSummaryLoading : isTimestampLoading || isTransactionsLoading)));

  return {
    interestUsd: hasBalance ? Math.max(interestInVaultCurrency * priceUsd, 0) : 0,
    /** Native units per share (1.0830 USD per soUSD, ETH per soETH, FUSE per soFUSE). */
    exchangeRate,
    isLoading,
  };
};
