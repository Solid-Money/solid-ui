import { View } from "react-native";
import { Address } from "viem";

import { Text } from "../ui/text";
import { eclipseAddress, formatNumber } from "@/lib/utils";
import { Button } from "../ui/button";
import RenderTokenIcon from "../RenderTokenIcon";
import { TokenIcon } from "@/lib/types";

import Checkmark from "@/assets/images/checkmark";

type TransactionStatusProps = {
  amount: number;
  hash: Address;
  onPress: () => void;
  title?: string;
  description?: string;
  status?: string;
  icon: TokenIcon;
  token?: string;
  buttonText?: string;
}

const TransactionStatus = ({
  amount,
  hash,
  onPress,
  title = "Transaction initiated",
  description = "This may take some time. We'll keep processing this in the background. You can safely leave this page.",
  status = "Initiated",
  icon,
  token = "USDC",
  buttonText = "Back to wallet",
}: TransactionStatusProps) => {
  return (
    <View className="gap-8">
      <View className="items-center">
        <Checkmark />
      </View>

      <View className="gap-2">
        <Text className="text-center text-2xl font-semibold">{title}</Text>
        <Text className="text-center leading-5 text-muted-foreground">{description}</Text>
      </View>

      <View className="gap-4">
        <View className="flex-row justify-between gap-2 bg-accent rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <RenderTokenIcon tokenIcon={icon} size={40} />
            <View>
              <View className="flex-row gap-1">
                <Text className="font-medium">{formatNumber(amount)}</Text>
                <Text className="text-muted-foreground">{token}</Text>
              </View>
              <View className="flex-row gap-1">
                <Text className="text-muted-foreground">to</Text>
                <Text className="font-medium">{eclipseAddress(hash)}</Text>
              </View>
            </View>
          </View>
          <Text className="text-muted-foreground font-medium">{status}</Text>
        </View>
        <Button
          variant="brand"
          className="rounded-2xl h-12"
          onPress={onPress}
        >
          <Text className="text-lg font-semibold">
            {buttonText}
          </Text>
        </Button>
      </View>
    </View>
  )
}

export default TransactionStatus;
