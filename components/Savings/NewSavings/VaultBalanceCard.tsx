import { View } from 'react-native';
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
import { formatNumber } from '@/lib/utils';

export const formatCompactVaultUsd = (value: number) => {
  const safeValue = Math.max(Number(value) || 0, 0);
  const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })
    .format(safeValue)
    .toUpperCase();
  return `${compact} USD`;
};

export const formatExactVaultUsd = (value: number) =>
  `$${formatNumber(Math.max(Number(value) || 0, 0), 1, 1)}`;

const VaultStat = ({
  label,
  tooltip,
  value,
  isLoading = false,
}: {
  label: string;
  tooltip: string;
  value: number;
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
        <Text className="mt-[7px] text-[26px] font-semibold leading-6 text-white">
          {formatCompactVaultUsd(value)}
        </Text>
        <Text className="mt-[9px] text-[16px] leading-[17px] text-white/70">
          {formatExactVaultUsd(value)}
        </Text>
      </>
    )}
  </View>
);

interface VaultBalanceCardProps {
  vaultType: VaultType;
  balanceUsd: number;
}

/** Figma 24766:5317 — selected-vault balance and lifetime rewards. */
const VaultBalanceCard = ({ vaultType, balanceUsd }: VaultBalanceCardProps) => {
  const { user } = useUser();
  const vault = VAULTS.find(item => item.type === vaultType) ?? VAULTS[0];
  const { data: balance } = useVaultBalance(user?.safeAddress as Address, vault);
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
    summary: savingsSummary,
    vault: vault.name,
  });

  const isNativePriceLoading = vault.name !== 'USDC' && priceUsd <= 0;
  const isRewardsLoading =
    isApyLoading ||
    isNativePriceLoading ||
    (vault.name === 'FUSE' ? isSummaryLoading : isTimestampLoading || isTransactionsLoading);
  const rewardsUsd = Math.max(rewardsInVaultCurrency * priceUsd, 0);

  return (
    <View className="mx-4 h-[118px] flex-row overflow-hidden rounded-[20px] bg-[#1C1C1C]">
      <VaultStat
        label="Your Balance"
        tooltip="The amount currently available in this vault."
        value={balanceUsd}
      />
      <View className="h-full w-px bg-white/10" />
      <VaultStat
        label="Total Rewards"
        tooltip="The interest this vault has earned for you so far."
        value={rewardsUsd}
        isLoading={isRewardsLoading}
      />
    </View>
  );
};

export default VaultBalanceCard;
