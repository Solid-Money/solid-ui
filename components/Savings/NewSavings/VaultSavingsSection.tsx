import { TextStyle, View } from 'react-native';
import { Image } from 'expo-image';
import { Address } from 'viem';

import SavingCountUp from '@/components/SavingCountUp';
import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import {
  useAPYs,
  useLatestTokenTransfer,
  useMaxAPY,
  useUserTransactions,
} from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useSavingsSummary } from '@/hooks/useSavingsSummary';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { SavingMode, VaultType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

import { getVaultDisplay } from './savingsVaultData';

const VALUE_STYLE: TextStyle = {
  fontSize: 30,
  fontWeight: '600',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const INTEREST_STYLE: TextStyle = {
  fontSize: 15,
  fontWeight: '600',
  color: '#94F27F',
};

interface VaultSavingsSectionProps {
  vaultType: VaultType;
}

/**
 * The selected vault's savings detail ("USDC savings" → "{selected} savings"
 * when the APY dropdown switches). Shows the live redeemable value and interest
 * earned, reusing the same per-vault plumbing + SavingCountUp as the legacy
 * savings screen.
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

  const isUsdc = vault.name === 'USDC';
  const prefix = isUsdc ? '$' : undefined;
  const suffix = isUsdc ? '' : vault.name;
  const decimalPlaces = vault.name === 'ETH' ? 8 : 2;

  const commonProps = {
    balance: balance ?? 0,
    decimals: vault.decimals,
    apy: vaultAPY,
    lastTimestamp: firstDepositTimestamp ?? 0,
    userDepositTransactions,
    exchangeRate,
    tokenAddress: vault.vaults[0].address,
    vault: vault.name,
    summary: savingsSummary,
    animateOnMount: false,
  };

  return (
    <View className="mx-4 gap-3 rounded-twice bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Image
            source={getAsset(vault.icon)}
            style={{ width: 24, height: 24, borderRadius: 12 }}
            contentFit="contain"
          />
          <Text className="text-lg font-semibold text-white">{display.name} savings</Text>
        </View>
        <Text className="text-base font-semibold text-white">
          {formatNumber(maxAPY ?? 0, 1)}% APY
        </Text>
      </View>

      <SavingCountUp
        {...commonProps}
        prefix={prefix}
        suffix={suffix}
        decimalPlaces={decimalPlaces}
        styles={{ wholeText: VALUE_STYLE, decimalText: VALUE_STYLE, decimalSeparator: VALUE_STYLE }}
      />

      <View className="flex-row items-baseline gap-1">
        <SavingCountUp
          {...commonProps}
          mode={SavingMode.CURRENT}
          inputsReady={!isAPYsLoading && Boolean(balance && (firstDepositTimestamp ?? 0) > 0)}
          prefix={prefix}
          suffix={suffix}
          decimalPlaces={decimalPlaces}
          styles={{ wholeText: INTEREST_STYLE, decimalText: INTEREST_STYLE }}
        />
        <Text className="text-sm text-muted-foreground">Interest earned</Text>
      </View>
    </View>
  );
};

export default VaultSavingsSection;
