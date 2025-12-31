import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { ChevronRight } from 'lucide-react-native';
import { Image, TouchableOpacity, View } from 'react-native';

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
      <Text className="text-base text-muted-foreground font-medium mb-2">
        Choose the type of withdraw
      </Text>

      {/* Fast Withdraw Card */}
      <TouchableOpacity
        onPress={handleFastWithdraw}
        className="bg-primary/10 rounded-[15px] p-5 overflow-hidden active:opacity-80"
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-lg font-semibold text-foreground">Fast withdraw</Text>
          <ChevronRight size={20} color="white" />
        </View>

        <View className="mb-4">
          <Text className="text-muted-foreground font-medium text-base">
            Including fee | Up to 4 mins
          </Text>
        </View>

        {/* Network Icons Stack */}
        <View className="flex-row items-center">
          {Object.entries(BRIDGE_TOKENS).map(([id, network], index) => (
            <View
              key={id}
              className="border border-background rounded-full bg-white w-[30px] h-[30px] items-center justify-center overflow-hidden"
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
        className="bg-primary/10 rounded-[15px] p-5 overflow-hidden active:opacity-80"
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-lg font-semibold text-foreground">Regular withdraw</Text>
          <ChevronRight size={20} color="white" />
        </View>

        <View className="mb-4">
          <Text className="text-muted-foreground font-medium text-base">
            No fee | Up to 24 hours
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className="border border-background rounded-full bg-white w-[30px] h-[30px] items-center justify-center overflow-hidden">
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
