import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

interface CircularActionButtonProps {
  icon: any;
  label: string;
  onPress?: () => void;
  className?: string;
  size?: number;
  isLoading?: boolean;
  showBackground?: boolean;
}

export function CircularActionButton({
  icon,
  label,
  onPress,
  className = '',
  size = 50,
  isLoading = false,
  showBackground = false,
}: CircularActionButtonProps) {
  const iconSize = size;

  return (
    <View className={`flex-1 items-center ${className}`}>
      <Pressable
        onPress={onPress}
        className={`web:hover:opacity-70 ${showBackground ? 'items-center justify-center rounded-full bg-[#303030]' : ''}`}
        style={showBackground ? { width: size, height: size } : undefined}
      >
        {isLoading ? (
          <View style={{ width: size, height: size }} className="items-center justify-center">
            <ActivityIndicator color="#BFBFBF" />
          </View>
        ) : (
          <Image source={icon} style={{ width: iconSize, height: iconSize }} />
        )}
      </Pressable>
      <Text className="mt-2 text-[#BFBFBF]">{label}</Text>
    </View>
  );
}
