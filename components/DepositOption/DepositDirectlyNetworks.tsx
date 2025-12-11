import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { mainnet } from 'viem/chains';

const ESTIMATED_TIMES: Record<number, string> = {
  [mainnet.id]: 'Estimated speed: 5 min',
};
const DEFAULT_ESTIMATED_TIME = 'Estimated speed: 30 min';

const DepositDirectlyNetworks = () => {
  const { setModal } = useDepositStore();
  const { user } = useUser();
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const sortedNetworks = useMemo(
    () => Object.entries(BRIDGE_TOKENS).sort((a, b) => a[1].sort - b[1].sort),
    [],
  );

  const handlePress = async (chainId: number) => {
    const network = BRIDGE_TOKENS[chainId];

    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      chain_id: chainId,
      network_name: network?.name,
      deposit_type: 'direct_deposit',
      deposit_method: 'external_wallet_direct',
    });

    try {
      setSelectedChainId(chainId);
      const session = await createDirectDepositSession(chainId);

      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        wallet_address: session.walletAddress,
        chain_id: chainId,
        network_name: network?.name,
        deposit_type: 'direct_deposit',
      });

      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    } catch (error) {
      console.error('Failed to create direct deposit session:', error);
      setSelectedChainId(null);
      Toast.show({
        type: 'error',
        text1: 'Failed to create deposit session',
        text2: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-muted-foreground font-medium text-[1rem]">Choose a network</Text>

      <View className="gap-y-1.5">
        {sortedNetworks.map(([id, network]) => {
          const chainId = Number(id);
          return (
            <DepositNetwork
              key={chainId}
              name={network.name}
              description={ESTIMATED_TIMES[chainId] ?? DEFAULT_ESTIMATED_TIME}
              icon={network.icon}
              isComingSoon={network.isComingSoon}
              onPress={() => handlePress(chainId)}
              disabled={isLoading}
              isLoading={isLoading && selectedChainId === chainId}
            />
          );
        })}
      </View>
    </View>
  );
};

export default DepositDirectlyNetworks;
