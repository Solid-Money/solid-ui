import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import DepositComingSoon from '@/components/DepositOption/DepositComingSoon';
import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { Vault } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  wallet: 'Crypto wallet',
  deposit_directly: 'Direct deposit',
  credit_card: 'Credit card',
  bank_transfer: 'Bank transfer',
};

const getDepositMethodsSummary = (vault: Vault): string => {
  const methods = vault.depositConfig?.methods ?? [];
  if (methods.length === 0) return '';
  const labels = methods.map(m => DEPOSIT_METHOD_LABELS[m] ?? m);
  return labels.join(', ');
};

interface VaultCardProps {
  vault: Vault;
  index: number;
}

const VaultCard = ({ vault, index }: VaultCardProps) => {
  const { maxAPY } = useMaxAPY(vault.type);
  const isComingSoon = !!vault.isComingSoon;
  const iconSource = getAsset(vault.icon);
  const subtitle = getDepositMethodsSummary(vault);

  const handlePress = () => {
    if (isComingSoon) return;

    useSavingStore.getState().selectVaultForDeposit(index);
    useDepositStore.getState().setSrcChainId(0);
    useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS);

    track(TRACKING_EVENTS.DEPOSIT_VAULT_SELECTED, {
      vault_name: vault.name,
      vault_type: vault.type,
      vault_index: index,
    });
  };

  return (
    <Pressable
      className="native:py-10 flex-row items-center justify-between rounded-2xl bg-card px-5 web:py-6 web:hover:bg-card-hover"
      onPress={handlePress}
      disabled={isComingSoon}
      style={isComingSoon ? { opacity: 0.5 } : undefined}
    >
      <View className="flex-1 flex-row items-center gap-x-4">
        <Image source={iconSource} className="h-10 w-10" contentFit="contain" />
        <View className="flex-1 flex-col gap-y-1">
          <Text className="text-lg font-semibold leading-6 text-primary">{vault.name}</Text>
          {subtitle ? (
            <Text className="text-sm leading-5 text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View className="ml-3 self-center">
        {isComingSoon ? (
          <DepositComingSoon />
        ) : maxAPY ? (
          <Text className="text-base font-semibold text-[#94F27F]">{maxAPY.toFixed(2)}% APY</Text>
        ) : (
          <ChevronRight color="white" size={20} />
        )}
      </View>
    </Pressable>
  );
};

const DepositVaultSelector = () => {
  const { user } = useUser();

  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_VAULT_SELECTOR_VIEWED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      vaults_count: VAULTS.length,
    });
  }, [user?.userId, user?.safeAddress]);

  return (
    <View className="gap-y-2.5">
      {VAULTS.map((vault, index) => (
        <VaultCard key={vault.name} vault={vault} index={index} />
      ))}
    </View>
  );
};

export default DepositVaultSelector;
