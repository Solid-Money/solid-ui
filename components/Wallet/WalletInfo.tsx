import { View } from "react-native";

import { Text } from "../ui/text";

interface WalletInfoProps {
  text: string;
}

const WalletInfo = ({ text }: WalletInfoProps) => {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-lg">{text}</Text>
    </View>
  );
};

export default WalletInfo;
