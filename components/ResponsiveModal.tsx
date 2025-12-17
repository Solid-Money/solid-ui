import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import React, { ReactNode, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
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
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

const ANIMATION_DURATION = 150;

export interface ModalState {
  name: string;
  number: number;
}

export interface ResponsiveModalProps {
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
  actionButton?: ReactNode;

  // Animation
  shouldAnimate?: boolean;
  isForward?: boolean;
  contentKey: string;
}

const ResponsiveModal = ({
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
  actionButton,
  shouldAnimate = previousModal.name !== 'close',
  isForward = currentModal.number > previousModal.number,
  contentKey,
}: ResponsiveModalProps) => {
  const { isScreenMedium } = useDimension();
  const dialogHeight = useSharedValue(0);
  const [showBottomFade, setShowBottomFade] = React.useState(false);
  const containerHeightRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);

  const dialogAnimatedStyle = useAnimatedStyle(() => {
    // on native, let the content determine its own height initially
    if (dialogHeight.value === 0) {
      return {};
    }
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

  // Prevent page scroll when modal closes by stopping focus restoration to trigger
  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const hasBackButton = showBackButton && !!onBackPress;
  const hasHeader = !!title || hasBackButton;
  const hasActionButton = hasBackButton && !!actionButton;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger !== null && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          'p-4 md:p-8 md:max-w-md',
          contentClassName,
          !isScreenMedium ? 'w-screen max-w-full mt-8 justify-start' : '',
        )}
        onCloseAutoFocus={handleCloseAutoFocus}
        showCloseButton={false}
      >
        <Animated.View style={dialogAnimatedStyle} className="overflow-hidden">
          <View
            className={cn('gap-8', containerClassName)}
            onLayout={event => {
              dialogHeight.value = event.nativeEvent.layout.height;
            }}
          >
            {hasHeader ? (
              <DialogHeader
                className={cn('flex-row items-center gap-2 justify-between', titleClassName)}
              >
                {hasBackButton ? (
                  <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 rounded-full p-0 bg-popover web:transition-colors web:hover:bg-muted"
                      onPress={onBackPress}
                    >
                      <ArrowLeft color="white" size={20} />
                    </Button>
                  </Animated.View>
                ) : (
                  <View className="w-10" />
                )}
                {title && (
                  <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                    <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
                  </Animated.View>
                )}
                {hasActionButton && (
                  <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                    {actionButton}
                  </Animated.View>
                )}
                <DialogCloseButton />
              </DialogHeader>
            ) : (
              <View className="flex-row justify-end">
                <DialogCloseButton />
              </View>
            )}
            <View className="relative">
              <ScrollView
                className="max-h-[80vh]"
                showsVerticalScrollIndicator={false}
                onLayout={e => {
                  containerHeightRef.current = e.nativeEvent.layout.height;
                  setShowBottomFade(contentHeightRef.current > containerHeightRef.current + 4);
                }}
                onContentSizeChange={(_, h) => {
                  contentHeightRef.current = h;
                  if (containerHeightRef.current > 0) {
                    setShowBottomFade(h > containerHeightRef.current + 4);
                  }
                }}
                onScroll={e => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  const atBottom =
                    contentOffset.y + layoutMeasurement.height >= contentSize.height - 8;
                  setShowBottomFade(!atBottom);
                }}
                scrollEventThrottle={16}
              >
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
              </ScrollView>
              {showBottomFade && (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24 }}
                >
                  <LinearGradient
                    colors={[
                      'rgba(30, 30, 30, 0)',
                      'rgba(30, 30, 30, 0.5)',
                      'rgba(30, 30, 30, 0.85)',
                    ]}
                    locations={[0, 0.6, 1]}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveModal;
