import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

type UnderlineProps = {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  textClassName?: string;
  borderColor?: string;
  borderWidth?: number;
  inline?: boolean;
};

export function Underline({
  children,
  onPress,
  className,
  textClassName,
  borderColor = 'rgba(255, 255, 255, 0.6)',
  borderWidth = 0.5,
  inline = false,
}: UnderlineProps) {
  if (inline) {
    if (Platform.OS === 'web') {
      return (
        <Text
          className={textClassName}
          style={{
            textDecorationLine: 'underline',
            textDecorationColor: borderColor,
          }}
          onPress={onPress}
        >
          {children}
        </Text>
      );
    }

    // Native: use textDecorationLine with explicit style and color
    return (
      <Text
        className={textClassName}
        style={{
          textDecorationLine: 'underline',
          textDecorationStyle: 'solid',
          textDecorationColor: borderColor,
        }}
        onPress={onPress}
      >
        {children}
      </Text>
    );
  }

  // Block mode: View with border bottom (works on all platforms)
  const content = (
    <View
      style={{
        borderBottomWidth: borderWidth,
        borderBottomColor: borderColor,
        alignSelf: 'baseline',
      }}
      className={className}
    >
      <Text className={textClassName}>{children}</Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}
