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
import { getVaultCurrency } from '@/lib/vaultCurrency';

/**
 * The vault's activity address on Fuse, for the latest-transfer read. soEURC has no Fuse
 * leg, so it has none, and must not fall through to another vault's.
 */
const fuseActivityAddress = (vaultType: VaultType): string | undefined => {
  switch (vaultType) {
    case VaultType.USDC:
      return ADDRESSES.fuse.vault;
    case VaultType.ETH:
      return ADDRESSES.fuse.soEthVault;
    case VaultType.FUSE:
      return ADDRESSES.fuse.fuseVault;
    default:
      return undefined;
  }
};

/**
 * Interest one vault has earned for the user since their first deposit.
 *
 * The same figure the vault page has always shown as "Total Rewards": soUSD and soETH
 * work it out from the deposit history, soFUSE and soEURC from the backend summary (they
 * have no usable transfer history), and FUSE / ETH are priced live.
 *
 * `interest` is in the vault's own currency — euros for soEURC, which is never converted —
 * and `interestUsd` is the USD figure, always 0 for soEURC so no dollar total picks it up.
 */
export const useVaultInterestEarned = (vaultType: VaultType) => {
  const { user } = useUser();
  const vault = VAULTS.find(item => item.type === vaultType) ?? VAULTS[0];
  const currency = getVaultCurrency(vault.type);
  const activityAddress = fuseActivityAddress(vault.type);
  const { data: balance, isLoading: isBalanceLoading } = useVaultBalance(
    user?.safeAddress as Address,
    vault,
  );
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);
  const { data: apys, isLoading: isApyLoading } = useAPYs(vault.type);
  // An empty address disables the read (see useLatestTokenTransfer).
  const { data: lastTimestamp, isLoading: isTimestampLoading } = useLatestTokenTransfer(
    activityAddress ? (user?.safeAddress ?? '') : '',
    activityAddress ?? '',
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
  // soFUSE and soEURC have no subgraph, so their interest comes from the backend summary.
  const usesSummary = vault.type === VaultType.FUSE || vault.type === VaultType.EUR;
  const { data: savingsSummary, isLoading: isSummaryLoading } = useSavingsSummary(
    vault.name,
    usesSummary,
  );

  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', vault.type === VaultType.FUSE);
  const ethPriceUsd = useNativePriceUsd(mainnet.id, 'ethPriceUsd', vault.type === VaultType.ETH);
  // Price of one unit of the vault's asset in the vault's currency: 1 for soUSD (USD) and
  // soEURC (EUR, which stays EUR), the live USD price for FUSE / ETH.
  const price =
    vault.type === VaultType.FUSE ? fusePriceUsd : vault.type === VaultType.ETH ? ethPriceUsd : 1;
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
  const isNativePriceLoading = hasBalance && price <= 0;
  const isLoading =
    isBalanceLoading ||
    (hasBalance &&
      (isApyLoading ||
        isNativePriceLoading ||
        (usesSummary
          ? isSummaryLoading
          : (!!activityAddress && isTimestampLoading) || isTransactionsLoading)));
  const interest = hasBalance ? Math.max(interestInVaultCurrency * price, 0) : 0;

  return {
    interest,
    currency,
    interestUsd: currency === 'USD' ? interest : 0,
    /** Native units per share (1.0830 USD per soUSD, ETH per soETH, FUSE per soFUSE). */
    exchangeRate,
    isLoading,
  };
};
