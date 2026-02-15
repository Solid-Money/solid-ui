import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type ExchangeFeature = 'swap' | 'bridge' | 'buyCrypto';

interface ExchangeDisclaimerProps {
  feature: ExchangeFeature;
  onAccept: () => void;
}

const PARTNER_INFO: Record<ExchangeFeature, string> = {
  swap: 'Swap services powered by Algebra Protocol and Voltage Finance',
  bridge: 'Bridge services powered by LiFi and Stargate Finance',
  buyCrypto: 'Purchase services powered by Mercuryo',
};

export default function ExchangeDisclaimer({ feature, onAccept }: ExchangeDisclaimerProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="items-center gap-5">
        <View className="items-center justify-center rounded-full bg-foreground/10 p-4">
          <Ionicons name="shield-checkmark-outline" size={40} color="#9CA3AF" />
        </View>

        <Text className="text-center text-xl font-semibold">Third-Party Exchange Services</Text>

        <Text className="text-center text-base leading-6 text-muted-foreground">
          Exchange services in this app are provided by third-party partners. Solid does not
          directly operate cryptocurrency exchange services. By continuing, you acknowledge that you
          are interacting with third-party protocols.
        </Text>

        <View className="mt-1 rounded-lg bg-foreground/5 px-4 py-3">
          <Text className="text-center text-sm text-muted-foreground">{PARTNER_INFO[feature]}</Text>
        </View>

        <View className="mt-4 self-stretch">
          <Button onPress={onAccept} size="lg" variant="brand" className="rounded-xl">
            <Text className="text-base font-bold">I Understand</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
