import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import CardWithBottomShadow from "@/assets/images/card_with_bottom_shadow";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { path } from "@/constants/path";
import { useCardStatus } from "@/hooks/useCardStatus";

export default function Card() {
  const router = useRouter();
  const { data: cardStatus, isLoading, error, refetch } = useCardStatus();

  useEffect(() => {
    if (isLoading) return;

    // If card exists (regardless of status), go to card details
    if (cardStatus) {
      router.replace(path.CARD_DETAILS);
      return;
    }
  }, [cardStatus, isLoading, error, router]);

  const activateCard = async () => {
    router.push(path.CARD_ACTIVATE_MOBILE);
  };

  // Show loading state while checking card status
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-lg">Loading...</Text>
      </View>
    );
  }

  // Show error state for non-404 errors
  if (error && (error as any)?.status !== 404) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-lg text-red-500">Error loading card status</Text>
        <Button className="mt-4" onPress={() => refetch()}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-evenly items-center p-6 bg-background">
      <View>
        <Text className="text-4xl font-extrabold text-center">
          Introducing the{"\n"}Solid card
        </Text>
        <Text className="text-lg mt-2 font-medium text-center text-white/70 leading-[20px]">
          The world&apos;s first self-custodial{"\n"}Mastercard by Solid
        </Text>
      </View>

      <CardWithBottomShadow />

      <View className="w-full space-y-4">
        <Button className="rounded-xl h-14 w-full" onPress={activateCard}>
          <Text className="text-[20px] font-bold">Activate card</Text>
        </Button>
      </View>
    </View>
  );
}
