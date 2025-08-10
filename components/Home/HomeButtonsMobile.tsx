import { router } from "expo-router";
import { View } from "react-native";
import { Plus } from "lucide-react-native";

import { path } from "@/constants/path";
import CircleButton from "../CircleButton";

import HomeSend from "@/assets/images/home-send";
import HomeCard from "@/assets/images/home-card";
import HomeSwap from "@/assets/images/home-swap";

const HomeButtonsMobile = () => {
  return (
    <View className="flex-row justify-around px-2 items-center w-full mx-auto">
      <CircleButton
        icon={Plus}
        label="Fund"
        onPress={() => router.push(path.DEPOSIT)}
        backgroundColor="bg-[#94F27F]"
        iconColor="#000000"
      />

      <CircleButton
        icon={HomeSend}
        label="Send"
        onPress={() => router.push(path.SEND)}
        scale={0.9}
        viewBox="0 0 25 24"
      />

      <CircleButton
        icon={HomeCard}
        label="Card"
        onPress={() => router.push(path.CARD)}
        scale={1}
        viewBox="0 0 25 21"
      />

      <CircleButton
        icon={HomeSwap}
        label="Swap"
        onPress={() => router.push(path.SWAP)}
        scale={1}
        viewBox="0 0 29 28"
      />
    </View>
  );
};

export default HomeButtonsMobile;
