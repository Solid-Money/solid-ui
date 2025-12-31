import { ArrowLeft } from 'lucide-react-native';
import React, { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ANIMATION_DURATION = 150;

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
      <DialogContent className={cn('p-6 md:p-8 md:max-w-md', contentClassName)}>
        <Animated.View style={dialogAnimatedStyle} className="overflow-hidden">
          <View
            className={cn('gap-8', containerClassName)}
            onLayout={event => {
              dialogHeight.value = event.nativeEvent.layout.height;
            }}
          >
            {title && (
              <DialogHeader
                className={cn('flex-row justify-between items-center gap-2', titleClassName)}
              >
                {showBackButton && onBackPress && (
                  <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 rounded-full p-0 bg-popover web:transition-colors web:hover:bg-muted"
                      onPress={onBackPress}
                    >
                      <ArrowLeft color="white" size={20} />
                    </Button>
                  </Animated.View>
                )}
                <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                  <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
                </Animated.View>
                {showBackButton && <View className="w-10" />}
              </DialogHeader>
            )}
            <Animated.View
              entering={
                shouldAnimate
                  ? isForward
                    ? FadeInRight.duration(ANIMATION_DURATION)
                    : FadeInLeft.duration(ANIMATION_DURATION)
                  : undefined
              }
              exiting={
                isForward
                  ? FadeOutLeft.duration(ANIMATION_DURATION)
                  : FadeOutRight.duration(ANIMATION_DURATION)
              }
              key={contentKey}
            >
              {children}
            </Animated.View>
          </View>
        </Animated.View>
      </DialogContent>
    </Dialog>
  );
};

export default AnimatedModal;
