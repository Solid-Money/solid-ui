import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import React from "react";
import { View } from "react-native";

import Loading from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useCardDetails } from "@/hooks/useCardDetails";

export default function CardDetails() {
  const { data: cardDetails, isLoading } = useCardDetails();

  const availableBalance = cardDetails?.balances.available;
  const currency = availableBalance?.currency || "?";
  const availableAmount = availableBalance?.amount || "0";

  if (isLoading) return <Loading />

  return (
    <View className="flex-1 bg-background p-6">
      {/* Balance Information */}
      <View className="items-center mt-10 mb-6">
        <View className="flex-row items-baseline">
          <Text className="text-xl font-semibold">{currency}</Text>
          <Text className="text-[50px] font-semibold">{availableAmount}</Text>
        </View>
        <Text className="text-base opacity-70 mt-2">Spendable balance</Text>
      </View>

      <Button className="rounded-3xl h-10 w-auto self-center mb-6">
        <View className="flex-row">
          <Plus color="black" />
          <Text className="font-bold text-base ml-2">Add funds</Text>
        </View>
      </Button>

      <View className="items-center mb-8">
        <Image
          source={require("@/assets/images/card.png")}
          alt="Solid Card"
          style={{ width: "30%", aspectRatio: 4 / 3 }}
          contentFit="contain"
        />
      </View>

      {/* Circular Action Buttons */}
      <View className="flex-row justify-around items-center w-1/4 self-center">
        <View className="items-center">
          <Button className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200">
            <Image
              source={require("@/assets/images/settings.png")}
              style={{ width: 34, height: 34 }}
            />
          </Button>
          <Text className="text-xs mt-2 text-muted-foreground">Settings</Text>
        </View>

        <View className="items-center">
          <Button className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200">
            <Image
              source={require("@/assets/images/limit.png")}
              style={{ width: 34, height: 34 }}
            />
          </Button>
          <Text className="text-xs mt-2 text-muted-foreground">Limit</Text>
        </View>

        <View className="items-center">
          <Button className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200">
            <Image
              source={require("@/assets/images/freeze.png")}
              style={{ width: 28, height: 28 }}
            />
          </Button>
          <Text className="text-xs mt-2 text-muted-foreground">Freeze</Text>
        </View>
      </View>
    </View>
  );
}
