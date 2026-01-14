import React from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface ResponsiveModalMobileProps {
  containerClassName?: string;
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  titleClassName?: string;
  actionButton?: React.ReactNode;
  contentKey: string;
  children: React.ReactNode;
  shouldAnimate?: boolean;
  isForward?: boolean;
}

const ResponsiveModalMobile = ({
  containerClassName,
  title,
  showBackButton,
  onBackPress,
  titleClassName,
  actionButton,
  contentKey,
  children,
  shouldAnimate = true,
  isForward = true,
}: ResponsiveModalMobileProps) => {
  const titleEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(10).springify()
    : undefined;

  const titleExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(10);

  const contentEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(250)
    : undefined;

  const contentExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(250);

  return (
    <View className={cn('gap-2 md:gap-6', containerClassName)}>
      {(title || (showBackButton && onBackPress)) && (
        <View className={cn('flex-row items-center justify-between gap-2', titleClassName)}>
          {showBackButton && onBackPress ? (
            <Button
              variant="ghost"
              className="h-10 w-10 rounded-full bg-popover p-0 web:transition-colors web:hover:bg-muted"
              onPress={onBackPress}
            >
              <ArrowLeft color="white" size={20} />
            </Button>
          ) : (
            <View className="w-10" />
          )}
          {title && (
            <View className="flex-1 items-center">
              <Animated.View key={contentKey} entering={titleEntering} exiting={titleExiting}>
                <Text className="text-center text-xl font-semibold text-white md:text-2xl">
                  {title}
                </Text>
              </Animated.View>
            </View>
          )}
          {showBackButton && (actionButton ? actionButton : <View className="w-10" />)}
        </View>
      )}
      <Animated.View key={contentKey} entering={contentEntering} exiting={contentExiting}>
        {children}
      </Animated.View>
    </View>
  );
};

export default ResponsiveModalMobile;
