import { useMemo } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const WithdrawNetworks = () => {
  const { setModal, setSelectedNetwork } = useUnstakeStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSelectedNetwork: state.setSelectedNetwork,
    })),
  );

  const sortedNetworks = useMemo(
    () => Object.entries(BRIDGE_TOKENS).sort((a, b) => a[1].sort - b[1].sort),
    [],
  );

  const handleSelectNetwork = (network: (typeof BRIDGE_TOKENS)[0]) => {
    setSelectedNetwork(network);
    setModal(UNSTAKE_MODAL.OPEN_FAST_WITHDRAW_FORM);
  };

  return (
    <View className="gap-y-2">
      <Text className="font-medium text-muted-foreground">Select a network to withdraw to</Text>

      <View className="gap-y-1.5">
        {sortedNetworks.map(([id, network]) => (
          <DepositNetwork
            key={id}
            name={network.name}
            description={
              network.bridgeSpeed === 0
                ? 'No Bridge Fee | Instant'
                : `Bridge Fee | Speed ${network.bridgeSpeed} mins`
            }
            icon={network.icon}
            onPress={() => handleSelectNetwork(network)}
          />
        ))}
      </View>
    </View>
  );
};

export default WithdrawNetworks;
