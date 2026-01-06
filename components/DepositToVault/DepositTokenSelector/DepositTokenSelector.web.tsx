import DepositNetwork from '@/components/DepositNetwork/DepositNetwork';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';
import { View } from 'react-native';

const DepositTokenSelector = () => {
  const { setModal, setOutputToken, srcChainId } = useDepositStore();

  const tokens = BRIDGE_TOKENS[srcChainId]?.tokens;

  const handlePress = (token: string) => {
    setOutputToken(token);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-y-2">
      <Text className="font-medium text-muted-foreground">Select a token</Text>

      <View className="gap-y-1.5">
        {Object.entries(tokens ?? {}).map(([key, token]) => {
          return (
            <DepositNetwork
              key={key}
              name={token?.name || key}
              description={token?.fullName || 'USD Coin'}
              icon={
                token?.icon ||
                getAsset('images/usdc.png')
              }
              isComingSoon={false}
              onPress={() => handlePress(key)}
            />
          );
        })}
      </View>
    </View>
  );
};

export default DepositTokenSelector;
