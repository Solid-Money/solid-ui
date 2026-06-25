import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function KycLoading() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#94F27F" />
      <Text className="mt-4 text-center text-[#ACACAC]">Preparing verification...</Text>
    </View>
  );
}

export function KycError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-20">
      <Text className="text-center text-red-400">{message}</Text>
      <Button variant="brand" onPress={onRetry} className="h-12 rounded-xl px-8">
        <Text className="font-semibold text-primary-foreground">Try again</Text>
      </Button>
    </View>
  );
}

/**
 * Shown when session creation fails because identity verification is
 * temporarily unavailable (backend VERIFICATION_UNAVAILABLE — depleted Didit
 * credit). Distinct from KycError: this is a transient, not-your-fault state,
 * so it reads calmer (no red) and nudges the user to retry later.
 */
export function KycUnavailable({
  message,
  onRetry,
  showBackButton = true,
}: {
  message?: string;
  onRetry: () => void;
  /** Render a back button at the top-left. Off on web, where the page header already has one. */
  showBackButton?: boolean;
}) {
  const body =
    message ??
    'We can’t start identity verification right now. Please try again in a little while.';
  return (
    <View className="flex-1">
      {showBackButton && (
        <View className="px-4 pt-2">
          <BackButton />
        </View>
      )}
      <View className="flex-1 items-center justify-center gap-4 px-8 pb-20">
        <Text className="text-center text-lg font-semibold text-white">
          Verification temporarily unavailable
        </Text>
        <Text className="text-center text-[#ACACAC]">{body}</Text>
        <Button variant="brand" onPress={onRetry} className="h-12 rounded-xl px-8">
          <Text className="font-semibold text-primary-foreground">Try again</Text>
        </Button>
        <Text className="text-center text-xs text-[#6B6B6B]">
          If this keeps happening, contact support.
        </Text>
      </View>
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
