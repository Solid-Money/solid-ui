import { View } from 'react-native';
import { mainnet } from 'viem/chains';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import DepositNetwork from './DepositNetwork';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { Text } from '../ui/text';

const DepositNetworks = () => {
  const { setModal, setSrcChainId } = useDepositStore();

  const handlePress = (id: number) => {
    setSrcChainId(id);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-y-4">
      <Text className="text-muted-foreground font-medium">Choose a network</Text>

      <View className="gap-y-2.5">
        {Object.entries(BRIDGE_TOKENS)
          .sort((a, b) => a[1].sort - b[1].sort)
          .map(([id, network]) => {
            const isEthereum = Number(id) === mainnet.id;
            const isSuggest = Number(id) === 0;
            const isComingSoon = network.isComingSoon;

            return (
              <DepositNetwork
                key={network.name}
                name={network.name}
                description={isSuggest ? 'Contact us on Telegram' : isEthereum ? 'Fee' : 'Gasless'}
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
