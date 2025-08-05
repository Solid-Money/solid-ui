import { AlertTriangle } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

const PasskeyNotSupported = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center space-y-6">
          <AlertTriangle size={48} color="orange" />

          <Text className="text-xl font-bold text-center">
            This browser doesn't support account creation
          </Text>

          <View className="space-y-4">
            <Text className="text-base text-center leading-6 max-w-lg">
              We've detected that you are using a browser which is incompatible with passkeys. This is common for any browser integrated into a wallet or social app.
            </Text>

            <Text className="text-base text-center leading-6">
              We recommend switching to Chrome to create your account.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default PasskeyNotSupported;
