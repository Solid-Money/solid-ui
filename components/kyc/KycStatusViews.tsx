import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function KycLoading() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#94F27F" />
      <Text className="mt-4 text-center text-[#ACACAC]">
        Preparing verification...
      </Text>
    </View>
  );
}

export function KycError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-20">
      <Text className="text-center text-red-400">{message}</Text>
      <Button variant="brand" onPress={onRetry} className="h-12 rounded-xl px-8">
        <Text className="font-semibold text-primary-foreground">Try again</Text>
      </Button>
    </View>
  );
}

export function KycCompleted() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-center text-lg font-semibold text-[#94F27F]">
        Verification complete!
      </Text>
      <Text className="mt-2 text-center text-[#ACACAC]">Redirecting...</Text>
    </View>
  );
}

export function KycNativeWaiting() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#94F27F" />
      <Text className="mt-4 text-center text-[#ACACAC]">
        Verification opened. Complete it and return here.
      </Text>
    </View>
  );
}
