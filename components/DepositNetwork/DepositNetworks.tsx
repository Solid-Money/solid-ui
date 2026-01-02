import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import DepositNetwork from './DepositNetwork';

const DepositNetworks = () => {
  const { setModal, setSrcChainId, setOutputToken } = useDepositStore();
  const { user } = useUser();

  const handlePress = (id: number) => {
    const network = BRIDGE_TOKENS[id];

    // Track network selection
    track(TRACKING_EVENTS.NETWORK_SELECTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      chain_id: id,
      network_name: network?.name,
      deposit_type: 'connected_wallet',
      deposit_method: 'cross_chain_bridge',
    });

    setSrcChainId(id);
    setOutputToken('USDC');
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-y-2">
      <Text className="text-[1rem] font-medium text-muted-foreground">Choose a network</Text>

      <View className="gap-y-1.5">
        {Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .map(([id, network]) => {
            const isEthereum = Number(id) === 1;
            const isComingSoon = network.isComingSoon;

            return (
              <DepositNetwork
                key={network.name}
                name={network.name}
                description={isEthereum ? 'Estimated speed: 5 min' : 'Estimated speed: 20 min'}
                icon={network.icon}
                isComingSoon={isComingSoon}
                onPress={() => handlePress(Number(id))}
              />
            );
          })}
      </View>
    </View>
  );
};

export default DepositNetworks;
