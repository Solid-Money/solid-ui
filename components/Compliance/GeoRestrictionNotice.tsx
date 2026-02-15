import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { RESTRICTION_NOTICE } from '@/constants/compliance';

interface GeoRestrictionNoticeProps {
  feature: string;
  onClose?: () => void;
}

export default function GeoRestrictionNotice({
  feature: _feature,
  onClose,
}: GeoRestrictionNoticeProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="items-center gap-4">
        <Ionicons name="globe-outline" size={48} color="#9CA3AF" />
        <Text className="text-center text-xl font-semibold">{RESTRICTION_NOTICE.title}</Text>
        <Text className="text-center text-base text-muted-foreground">
          {RESTRICTION_NOTICE.subtitle}
        </Text>
        {onClose && (
          <Text className="mt-4 text-base font-medium text-primary" onPress={onClose}>
            Dismiss
          </Text>
        )}
      </View>
    </View>
  );
}
