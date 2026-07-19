import { View } from 'react-native';
import { Image } from 'expo-image';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import {
  useAPYs,
  useLatestTokenTransfer,
  useMaxAPY,
  useUserTransactions,
} from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useNativePriceUsd } from '@/hooks/useNativePriceUsd';
import { useSavingsSummary } from '@/hooks/useSavingsSummary';
import { useSavingsYield } from '@/hooks/useSavingsYield';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { SavingMode, VaultType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

import { getVaultDisplay } from './savingsVaultData';

const DAYS_PER_YEAR = 365;
const fmtUsd = (value: number) => `$${formatNumber(Math.max(value, 0), 2, 2)}`;

const Stat = ({ label, value, positive }: { label: string; value: string; positive?: boolean }) => (
  <View className="flex-1 gap-1">
    <Text className="text-sm text-muted-foreground">{label}</Text>
    <Text className={cn('text-xl font-semibold', positive ? 'text-brand' : 'text-white')}>
      {value}
    </Text>
  </View>
);

interface VaultSavingsSectionProps {
  vaultType: VaultType;
}

/**
 * The selected vault's savings detail ("USDC savings" → "{selected} savings"
 * when the APY dropdown switches). All figures are shown in USD: FUSE/ETH
 * redeemable + interest are converted with the native token price. Reuses the
 * same per-vault plumbing (balance / rate / APY / yield) as the legacy screen.
 */
const VaultSavingsSection = ({ vaultType }: VaultSavingsSectionProps) => {
  const { user } = useUser();
  const vault = VAULTS.find(v => v.type === vaultType) ?? VAULTS[0];
  const display = getVaultDisplay(vaultType);

  const { data: balance } = useVaultBalance(user?.safeAddress as Address, vault);
  const { maxAPY } = useMaxAPY(vault.type);
  const { data: apys, isLoading: isAPYsLoading } = useAPYs(vault.type);
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);

  const vaultAPY =
    apys?.allTime != null && Number.isFinite(Number(apys.allTime)) ? Number(apys.allTime) : 0;

  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    vault.name === 'USDC'
      ? ADDRESSES.fuse.vault
      : vault.name === 'ETH'
        ? ADDRESSES.fuse.soEthVault
        : ADDRESSES.fuse.fuseVault,
  );
  const { data: userDepositTransactions } = useUserTransactions(user?.safeAddress, vault.type);
  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
    vault.decimals,
  );
  const { data: savingsSummary } = useSavingsSummary(vault.name, vault.name === 'FUSE');

  // USD price of the vault's native token (1 for USDC; FUSE/ETH priced live).
  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', vault.name === 'FUSE');
  const ethPriceUsd = useNativePriceUsd(mainnet.id, 'ethPriceUsd', vault.name === 'ETH');
  const priceUsd = vault.name === 'USDC' ? 1 : vault.name === 'FUSE' ? fusePriceUsd : ethPriceUsd;

  // Live interest (USD for USDC/FUSE; ETH-native × price for ETH).
  const interestRaw = useSavingsYield({
    balance: balance ?? 0,
    apy: vaultAPY,
    lastTimestamp: firstDepositTimestamp ?? 0,
    mode: SavingMode.CURRENT,
    decimals: vault.decimals,
    userDepositTransactions,
    exchangeRate,
    tokenAddress: vault.vaults[0].address,
    inputsReady: !isAPYsLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0),
    summary: savingsSummary,
    vault: vault.name,
  });

  const redeemableNative = (balance ?? 0) * (exchangeRate ?? 1);
  const availableUsd = vault.name === 'USDC' ? redeemableNative : redeemableNative * priceUsd;
  const interestUsd = vault.name === 'ETH' ? interestRaw * priceUsd : interestRaw;
  const depositedUsd = Math.max(availableUsd - interestUsd, 0);

  // No exact historical "this month" breakdown exists, so approximate from APY:
  // month-to-date and forward 30-day earnings on the current balance.
  const dayOfMonth = new Date().getDate();
  const apyFraction = (maxAPY ?? 0) / 100;
  const thisMonthUsd = availableUsd * apyFraction * (dayOfMonth / DAYS_PER_YEAR);
  const nextThirtyUsd = availableUsd * apyFraction * (30 / DAYS_PER_YEAR);

  return (
    <View className="mx-4 gap-4 rounded-twice bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Image
            source={getAsset(vault.icon)}
            style={{ width: 24, height: 24, borderRadius: 12 }}
            contentFit="contain"
          />
          <Text className="text-lg font-semibold text-white">{display.name} savings</Text>
        </View>
        <Text className="text-base font-semibold text-brand">
          {formatNumber(maxAPY ?? 0, 1)}% APY
        </Text>
      </View>

      <View className="h-px bg-white/10" />

      <View className="gap-4">
        <View className="flex-row">
          <Stat label="Deposited" value={fmtUsd(depositedUsd)} />
          <Stat label="Interest earned" value={fmtUsd(interestUsd)} />
        </View>
        <View className="flex-row">
          <Stat label="This month" value={`+${fmtUsd(thisMonthUsd)}`} positive />
          <Stat label="Next 30 days (est.)" value={`+${fmtUsd(nextThirtyUsd)}`} positive />
        </View>
      </View>

      <View className="h-px bg-white/10" />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted-foreground">Available to withdraw</Text>
        <Text className="text-base font-semibold text-white">{fmtUsd(availableUsd)}</Text>
      </View>
    </View>
  );
};

export default VaultSavingsSection;
