import { View } from 'react-native';

import { Text } from '@/components/ui/text';

interface CardStatusBannerProps {
  isPending: boolean;
  isBlocked: boolean;
  blockedReason: string;
}

export function CardStatusBanner({ isPending, isBlocked, blockedReason }: CardStatusBannerProps) {
  if (isPending) {
    return (
      <View className="mb-4 rounded-xl border border-yellow-500/30 bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold text-white">Your card is on its way</Text>
        <Text className="mt-2 text-sm text-white/70">
          We&rsquo;re finishing up your card. This may take some time.
        </Text>
      </View>
    );
  }

  if (isBlocked) {
    return (
      <View className="mb-4 rounded-xl border border-red-500/30 bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold text-white">Card activation rejected</Text>
        <Text className="mt-2 text-sm text-white/70">{blockedReason}</Text>
      </View>
    );
  }

  return null;
}
