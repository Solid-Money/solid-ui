import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

// Native version - useConnectModal is web-only in thirdweb
// External wallet connection is not supported on native
export default function CardDepositExternal() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-muted-foreground text-center">
        External wallet deposit is only available on web.
      </Text>
    </View>
  );
}
