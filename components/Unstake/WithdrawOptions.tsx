import { TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const WithdrawOptions = () => {
  const { setModal } = useUnstakeStore();

  const handleFastWithdraw = () => {
    setModal(UNSTAKE_MODAL.OPEN_NETWORKS);
  };

  const handleRegularWithdraw = () => {
    setModal(UNSTAKE_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-4 pt-4">
      <Text className="mb-2 text-base font-medium text-muted-foreground">
        Choose the type of withdraw
      </Text>

      {/* Fast Withdraw Card */}
      <TouchableOpacity
        onPress={handleFastWithdraw}
        className="overflow-hidden rounded-[15px] bg-primary/10 p-5 active:opacity-80"
      >
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">Fast withdraw</Text>
          <ChevronRight size={20} color="white" />
        </View>

        <View className="mb-4">
          <Text className="text-base font-medium text-muted-foreground">
            Including fee | Up to 4 mins
          </Text>
        </View>

        {/* Network Icons Stack */}
        <View className="flex-row items-center">
          {Object.entries(BRIDGE_TOKENS).map(([id, network], index) => (
            <View
              key={id}
              className="h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full border border-background bg-white"
              style={{
                zIndex: 50 - index,
                marginLeft: index === 0 ? 0 : -12,
              }}
            >
              <Image source={network.icon} style={{ width: 30, height: 30 }} />
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Regular Withdraw Card */}
      <TouchableOpacity
        onPress={handleRegularWithdraw}
        className="overflow-hidden rounded-[15px] bg-primary/10 p-5 active:opacity-80"
      >
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">Regular withdraw</Text>
          <ChevronRight size={20} color="white" />
        </View>

        <View className="mb-4">
          <Text className="text-base font-medium text-muted-foreground">
            No fee | Up to 24 hours
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className="h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full border border-background bg-white">
            {/* Ethereum/Asset */}
            <Image
              source={{ uri: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' }}
              style={{ width: 30, height: 30 }}
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default WithdrawOptions;
