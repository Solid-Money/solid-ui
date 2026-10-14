import { Platform, View } from 'react-native';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
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
import { getVaultCurrency, type VaultCurrency } from '@/lib/vaultCurrency';

import { formatCompactVaultAmount, formatExactVaultAmount } from './vaultBalanceFormat';

/**
 * Native keeps the value on one line and shrinks it to fit the half-width
 * column; web has no `adjustsFontSizeToFit`, so there it may wrap and the card
 * grows instead.
 */
const singleLineFit =
  Platform.OS === 'web'
    ? {}
    : ({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } as const);

const VaultStat = ({
  label,
  tooltip,
  value,
  currency,
  isLoading = false,
}: {
  label: string;
  tooltip: string;
  value: number;
  currency: VaultCurrency;
  isLoading?: boolean;
}) => (
  <View className="flex-1 px-5 pb-5 pt-[18px]">
    <View className="flex-row items-center gap-1">
      <Text className="text-[16px] leading-[17px] text-white/70">{label}</Text>
      <TooltipPopover
        text={tooltip}
        classNames={{ trigger: '-mt-[3px]', content: 'max-w-[260px]' }}
      />
    </View>
    {isLoading ? (
      <>
        <Skeleton className="mt-[9px] h-6 w-[100px] rounded-md bg-white/10" />
        <Skeleton className="mt-[9px] h-[14px] w-20 rounded-md bg-white/10" />
      </>
    ) : (
      <>
        {/* Native clips glyphs to the line box (iOS cuts the top, Android the
            bottom) and Mona Sans needs ~1.15em to fit, so both lines get that
            and the margins give the difference back. */}
        <Text
          className="mt-[3px] text-[26px] font-semibold leading-8 text-white"
          {...singleLineFit}
        >
          {formatCompactVaultAmount(value, currency)}
        </Text>
        <Text className="mt-[3px] text-[16px] leading-5 text-white/70">
          {formatExactVaultAmount(value, currency)}
        </Text>
      </>
    )}
  </View>
);

interface VaultBalanceCardProps {
  vaultType: VaultType;
  /** In the vault's own currency: USD, or EUR for soEURC. */
  balance: number;
}

/**
 * The vault's activity address on Fuse, for the latest-transfer read. soEURC has
 * no Fuse leg, so it has none, and must not fall through to another vault's.
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

/** Figma 24766:5317 — selected-vault balance and lifetime rewards. */
const VaultBalanceCard = ({ vaultType, balance: vaultBalance }: VaultBalanceCardProps) => {
  const { user } = useUser();
  const vault = VAULTS.find(item => item.type === vaultType) ?? VAULTS[0];
  const currency = getVaultCurrency(vault.type);
  const activityAddress = fuseActivityAddress(vault.type);
  const { data: balance } = useVaultBalance(user?.safeAddress as Address, vault);
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
  // soFUSE and soEURC have no subgraph, so their rewards come from the backend summary.
  const usesSummary = vault.type === VaultType.FUSE || vault.type === VaultType.EUR;
  const { data: savingsSummary, isLoading: isSummaryLoading } = useSavingsSummary(
    vault.name,
    usesSummary,
  );

  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', vault.type === VaultType.FUSE);
  const ethPriceUsd = useNativePriceUsd(mainnet.id, 'ethPriceUsd', vault.type === VaultType.ETH);
  // Price of one unit of the vault's asset in the currency the card shows: 1 for
  // soUSD (USD) and soEURC (EUR, which stays EUR), the live USD price for FUSE/ETH.
  const price =
    vault.type === VaultType.FUSE ? fusePriceUsd : vault.type === VaultType.ETH ? ethPriceUsd : 1;
  const vaultApy =
    apys?.allTime != null && Number.isFinite(Number(apys.allTime)) ? Number(apys.allTime) : 0;

  // `keepPreviousData` can hand this card the previous vault's summary while this
  // one loads — or for good, while soEURC's request fails until the backend
  // accepts `?vault=EUR`. Only this vault's own summary may stand for its rewards.
  const vaultSummary =
    savingsSummary?.vault?.toUpperCase() === vault.name.toUpperCase() ? savingsSummary : undefined;

  const rewardsInVaultCurrency = useSavingsYield({
    balance: balance ?? 0,
    apy: vaultApy,
    lastTimestamp: firstDepositTimestamp ?? 0,
    mode: SavingMode.CURRENT,
    decimals: vault.decimals,
    userDepositTransactions: transactions,
    exchangeRate,
    tokenAddress: vault.vaults[0].address,
    inputsReady: !isApyLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0),
    summary: vaultSummary,
    vault: vault.name,
  });

  const isNativePriceLoading = price <= 0;
  const isRewardsLoading =
    isApyLoading ||
    isNativePriceLoading ||
    (usesSummary
      ? isSummaryLoading
      : (!!activityAddress && isTimestampLoading) || isTransactionsLoading);
  const rewards = Math.max(rewardsInVaultCurrency * price, 0);

  return (
    <View className="mx-4 min-h-[118px] flex-row overflow-hidden rounded-[20px] bg-[#1C1C1C]">
      <VaultStat
        label="Your Balance"
        tooltip="The amount currently available in this vault."
        value={vaultBalance}
        currency={currency}
      />
      <View className="h-full w-px bg-white/10" />
      <VaultStat
        label="Total Rewards"
        tooltip="The interest this vault has earned for you so far."
        value={rewards}
        currency={currency}
        isLoading={isRewardsLoading}
      />
    </View>
  );
};

export default VaultBalanceCard;
