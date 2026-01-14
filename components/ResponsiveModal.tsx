import React, { ReactNode, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

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

const ANIMATION_DURATION = 350;

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

  const titleEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(10).springify()
    : undefined;

  const titleExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(10);

  const contentEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(250)
    : undefined;

  const contentExiting = (isForward ? FadeOutLeft : FadeOutRight).duration(250);

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
          'px-4 pb-0 pt-4 md:max-w-md md:px-8 md:pb-0 md:pt-8',
          contentClassName,
          !isScreenMedium ? 'mt-[5vh] w-screen max-w-full justify-start' : '',
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
                className={cn('flex-row items-center justify-between gap-2', titleClassName)}
              >
                {hasBackButton ? (
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
                  <Animated.View key={contentKey} entering={titleEntering} exiting={titleExiting}>
                    <DialogTitle className="native:text-2xl text-xl font-semibold">
                      {title}
                    </DialogTitle>
                  </Animated.View>
                )}
                {hasActionButton && actionButton}
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
                contentContainerClassName="pb-4 md:pb-8"
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
                <Animated.View entering={contentEntering} exiting={contentExiting} key={contentKey}>
                  {children}
                </Animated.View>
              </ScrollView>
              {showBottomFade && (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 }}
                >
                  <LinearGradient
                    colors={['rgba(16, 16, 16, 0)', 'rgba(16, 16, 16, 0.5)', 'rgba(16, 16, 16, 1)']}
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
