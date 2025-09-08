import { Image } from 'expo-image';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface CircularActionButtonProps {
  icon: any;
  label: string;
  onPress?: () => void;
  className?: string;
  size?: number;
}

export function CircularActionButton({
  icon,
  label,
  onPress,
  className = '',
  size = 50,
}: CircularActionButtonProps) {
  return (
    <View className={`items-center ${className}`}>
      <Pressable onPress={onPress} className="web:hover:opacity-70">
        <Image source={icon} style={{ width: size, height: size }} />
      </Pressable>
      <Text className="mt-2 text-[#BFBFBF]">{label}</Text>
    </View>
  );
}
