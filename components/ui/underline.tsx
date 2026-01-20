import * as React from 'react';
import { Pressable, View } from 'react-native';

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
  // For inline mode (nested in Text), use textDecorationLine
  if (inline) {
    const textContent = (
      <Text
        className={textClassName}
        style={{ textDecorationLine: 'underline', textDecorationColor: borderColor }}
        onPress={onPress}
      >
        {children}
      </Text>
    );
    return textContent;
  }

  // For block mode, use View with border
  const content = (
    <View
      style={{ borderBottomWidth: borderWidth, borderBottomColor: borderColor }}
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
