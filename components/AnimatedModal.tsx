import React, { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ANIMATION_DURATION = 350;

export interface ModalState {
  name: string;
  number: number;
}

export interface AnimatedModalProps {
  // Modal state management
  currentModal: ModalState;
  previousModal: ModalState;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

  // Content
  trigger: ReactNode;
  title?: string;
  children: ReactNode;

  // Styling
  contentClassName?: string;
  containerClassName?: string;
  titleClassName?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;

  // Animation
  shouldAnimate?: boolean;
  isForward?: boolean;
  contentKey: string;
}

const AnimatedModal = ({
  currentModal,
  previousModal,
  isOpen,
  onOpenChange,
  trigger,
  title,
  children,
  contentClassName,
  containerClassName,
  titleClassName,
  showBackButton = false,
  onBackPress,
  shouldAnimate = previousModal.name !== 'close',
  isForward = currentModal.number > previousModal.number,
  contentKey,
}: AnimatedModalProps) => {
  const dialogHeight = useSharedValue(0);

  const titleEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(10).springify()
    : undefined;

  const titleExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(10);

  const contentEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(250)
    : undefined;

  const contentExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(250);

  const dialogAnimatedStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) {
      return {
        height: dialogHeight.value,
      };
    }
    return {
      height: withTiming(dialogHeight.value, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    };
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn('p-6 md:max-w-md md:p-8', contentClassName)}>
        <Animated.View style={dialogAnimatedStyle} className="overflow-hidden">
          <View
            className={cn('gap-8', containerClassName)}
            onLayout={event => {
              dialogHeight.value = event.nativeEvent.layout.height;
            }}
          >
            {title && (
              <DialogHeader
                className={cn('flex-row items-center justify-between gap-2', titleClassName)}
              >
                {showBackButton && onBackPress && (
                  <Button
                    variant="ghost"
                    className="h-10 w-10 rounded-full bg-popover p-0 web:transition-colors web:hover:bg-muted"
                    onPress={onBackPress}
                  >
                    <ArrowLeft color="white" size={20} />
                  </Button>
                )}
                <Animated.View key={contentKey} entering={titleEntering} exiting={titleExiting}>
                  <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
                </Animated.View>
                {showBackButton && <View className="w-10" />}
              </DialogHeader>
            )}
            <Animated.View entering={contentEntering} exiting={contentExiting} key={contentKey}>
              {children}
            </Animated.View>
          </View>
        </Animated.View>
      </DialogContent>
    </Dialog>
  );
};

export default AnimatedModal;
