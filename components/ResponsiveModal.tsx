import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import React, { ReactNode, useCallback, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import useResponsiveModal from '@/hooks/useResponsiveModal';
import { cn } from '@/lib/utils';
import ResponsiveModalMobile from './ResponsiveModalMobile';

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
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dialogHeight = useSharedValue(0);
  const { triggerElement } = useResponsiveModal();
  const [showBottomFade, setShowBottomFade] = React.useState(false);
  const containerHeightRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);

  const handlePresentModalPress = useCallback(() => {
    onOpenChange(true);
  }, [onOpenChange]);

  // Handle bottom sheet presentation when isOpen changes
  React.useEffect(() => {
    if (!isScreenMedium) {
      if (isOpen) {
        bottomSheetModalRef.current?.present();
      } else {
        bottomSheetModalRef.current?.dismiss();
      }
    }
  }, [isOpen, isScreenMedium]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

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

  // Use modal for desktop web, bottom sheet for mobile web and native
  if (isScreenMedium) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        {trigger !== null && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className={cn('p-6 md:p-8 md:max-w-md', contentClassName)}>
          <Animated.View style={dialogAnimatedStyle} className="overflow-hidden">
            <View
              className={cn('gap-8', containerClassName)}
              onLayout={event => {
                dialogHeight.value = event.nativeEvent.layout.height;
              }}
            >
              {(title || (showBackButton && onBackPress)) && (
                <DialogHeader
                  className={cn(
                    'flex-row items-center gap-2',
                    showBackButton ? 'justify-between' : 'justify-center',
                    titleClassName,
                  )}
                >
                  {showBackButton && onBackPress && (
                    <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                      <Button
                        variant="ghost"
                        className="rounded-full p-0 web:hover:bg-transparent web:hover:opacity-70"
                        onPress={onBackPress}
                      >
                        <ArrowLeft color="white" size={20} />
                      </Button>
                    </Animated.View>
                  )}
                  {title && (
                    <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                      <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
                    </Animated.View>
                  )}
                  {showBackButton &&
                    (actionButton ? (
                      <Animated.View layout={LinearTransition.duration(ANIMATION_DURATION)}>
                        {actionButton}
                      </Animated.View>
                    ) : (
                      <View className="w-10" />
                    ))}
                </DialogHeader>
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
  }

  return (
    <View>
      {trigger !== null && (
        <Pressable
          onPress={handlePresentModalPress}
          style={({ pressed }) => [pressed && { opacity: 0.8 }]}
        >
          {triggerElement(trigger)}
        </Pressable>
      )}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={['90%']}
        backgroundStyle={{
          backgroundColor: 'black',
        }}
        handleIndicatorStyle={{
          backgroundColor: 'white',
        }}
        backdropComponent={renderBackdrop}
        onDismiss={() => onOpenChange(false)}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
            paddingTop: 12,
          }}
        >
          <ResponsiveModalMobile
            containerClassName={containerClassName}
            title={title}
            showBackButton={showBackButton}
            onBackPress={onBackPress}
            titleClassName={titleClassName}
            actionButton={actionButton}
            contentKey={contentKey}
          >
            {children}
          </ResponsiveModalMobile>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
};

export default ResponsiveModal;
