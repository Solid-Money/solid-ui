import { View } from "react-native";
import { router } from "expo-router"
  ;
import { DepositOptionModal } from "../DepositOption";
import { Text } from "../ui/text";
import { path } from "@/constants/path";
import { Button } from "../ui/button";

import HomeSend from "@/assets/images/home-send";
import HomeSwap from "@/assets/images/home-swap";
import WithdrawIcon from "@/assets/images/withdraw-icon";

const HomeButtons = () => {
  return (
    <View className="flex-row gap-2">
      <DepositOptionModal buttonText="Add funds" />
      <Button
        variant="secondary"
        className="h-12 px-6 rounded-xl bg-[#303030]"
        onPress={() => { }}
      >
        <View className="flex-row items-center gap-3">
          <WithdrawIcon />
          <Text className="text-white font-bold">Withdraw</Text>
        </View>
      </Button>
      <Button
        variant="secondary"
        className="h-12 px-6 rounded-xl bg-[#303030]"
        onPress={() => {
          router.push(path.SWAP);
        }}
      >
        <View className="flex-row items-center gap-2">
          <HomeSwap />
          <Text className="text-white font-bold">Swap</Text>
        </View>
      </Button>
      <Button
        variant="secondary"
        className="h-12 px-6 rounded-xl bg-[#303030]"
        onPress={() => {
          router.push(path.SEND);
        }}
      >
        <View className="flex-row items-center gap-2">
          <HomeSend />
          <Text className="text-white font-bold">Send</Text>
        </View>
      </Button>
    </View>
  )
};

export default HomeButtons;
