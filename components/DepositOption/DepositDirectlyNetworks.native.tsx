import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';

const DepositDirectlyNetworks = () => {
  const { setModal } = useDepositStore();
  const { user } = useUser();
  const { createDirectDepositSession, isLoading } = useDirectDepositSession();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const handlePress = async (id: number) => {
    try {
      setSelectedChainId(id);
      const network = BRIDGE_TOKENS[id];

      // Track network selection
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        chain_id: id,
        network_name: network?.name,
        deposit_type: 'direct_deposit',
        deposit_method: 'external_wallet_direct',
      });

      // Create direct deposit session
      const session = await createDirectDepositSession(id);

      // Track session creation
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        wallet_address: session.walletAddress,
        chain_id: id,
      });

      // Navigate to address display screen
      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    } catch (error) {
      console.error('Failed to create direct deposit session:', error);
      setSelectedChainId(null);
    }
  };

  return (
    <View className="gap-y-2">
      <Text className="text-muted-foreground font-medium">Choose a network</Text>

      <View className="gap-y-1.5">
        {Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .map(([id, network]) => {
            const chainId = Number(id);
            const isSelected = selectedChainId === chainId;
            const isComingSoon = network.isComingSoon;

            // Get estimated time based on chain
            let estimatedTime = 'Estimated speed: 30 min';
            if (chainId === 1) {
              estimatedTime = 'Estimated speed: 5 min';
            }

            return (
              <DepositNetwork
                key={network.name}
                name={network.name}
                description={estimatedTime}
                icon={network.icon}
                isComingSoon={isComingSoon}
                onPress={() => handlePress(chainId)}
                disabled={isLoading && isSelected}
              />
            );
          })}
      </View>
    </View>
  );
};

export default DepositDirectlyNetworks;
