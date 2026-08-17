import React, { ReactNode, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** Rendered inline, left of the title (e.g. the token being deposited). */
  titleIcon?: ReactNode;
  children: ReactNode;

  // Styling
  contentClassName?: string;
  containerClassName?: string;
  overlayClassName?: string;
  titleClassName?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  actionButton?: ReactNode;

  // Animation
  shouldAnimate?: boolean;
  isForward?: boolean;
  contentKey: string;

  // Layout
  /** Disable ScrollView wrapper when children manage their own scrolling (e.g. FlatList, camera views) */
  disableScroll?: boolean;
  hideHeader?: boolean;
  /**
   * Web only: cap the modal to the viewport height and flex the body, so the
   * header stays fixed and only the content scrolls (instead of the whole card
   * overflowing and the overlay scrolling the header away).
   */
  fillViewportHeight?: boolean;
}

const ResponsiveModal = ({
  currentModal,
  previousModal,
  isOpen,
  onOpenChange,
  trigger,
  title,
  titleIcon,
  children,
  contentClassName,
  containerClassName,
  overlayClassName,
  titleClassName,
  showBackButton = false,
  onBackPress,
  actionButton,
  shouldAnimate = previousModal.name !== 'close',
  isForward = currentModal.number > previousModal.number,
  contentKey,
  disableScroll = false,
  hideHeader = false,
  fillViewportHeight = false,
}: ResponsiveModalProps) => {
  const { isScreenMedium } = useDimension();
  const insets = useSafeAreaInsets();
  const isNativeSmallScreen = Platform.OS !== 'web' && !isScreenMedium;
  // On web, opt into the flex layout (header fixed, body scrolls) that native
  // small screens already use, capping the card to the viewport (see below).
  const webFill = fillViewportHeight && Platform.OS === 'web';
  const useNativeFlexLayout = isNativeSmallScreen || webFill;
  const useFixedHeightLayout = useNativeFlexLayout && !disableScroll;
  const dialogHeight = useSharedValue(0);
  const [showBottomFade, setShowBottomFade] = React.useState(false);
  const containerHeightRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);

  React.useEffect(() => {
    if (useFixedHeightLayout) {
      dialogHeight.value = 0;
    }
  }, [dialogHeight, useFixedHeightLayout]);

  const titleEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(10).springify()
    : undefined;

  const titleExiting = shouldAnimate
    ? (isForward ? FadeOutLeft : FadeOutRight).duration(10)
    : undefined;

  const contentEntering = shouldAnimate
    ? (isForward ? FadeInRight : FadeInLeft).duration(250)
    : undefined;

  const contentExiting = shouldAnimate
    ? (isForward ? FadeOutLeft : FadeOutRight).duration(250)
    : undefined;

  const dialogAnimatedStyle = useAnimatedStyle(() => {
    if (useNativeFlexLayout) {
      return {};
    }

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
  }, [shouldAnimate, useNativeFlexLayout]);

  // Prevent page scroll when modal closes by stopping focus restoration to trigger
  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const hasBackButton = showBackButton && !!onBackPress;
  const hasHeader = !hideHeader && (!!title || hasBackButton);
  const hasActionButton = hasBackButton && !!actionButton;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger !== null && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        overlayClassName={overlayClassName}
        className={cn(
          // Desktop popups get a uniform 40px inset. Three of the four sides live
          // here; the bottom stays 0 so the scroll viewport (and its bottom fade)
          // reaches the card edge, and the matching 40px goes on the scroll
          // content container below.
          'px-4 pb-0 pt-4 md:max-w-lg md:px-10 md:pb-0 md:pt-10',
          !isScreenMedium ? 'mt-[5vh] w-screen max-w-full justify-start' : '',
          webFill && 'max-h-[90vh]',
          contentClassName, // Put last so overrides take effect
        )}
        onCloseAutoFocus={handleCloseAutoFocus}
        showCloseButton={false}
      >
        <Animated.View
          style={[useNativeFlexLayout ? { flex: 1, minHeight: 0 } : undefined, dialogAnimatedStyle]}
          className={cn('overflow-hidden')}
        >
          <View
            className={cn('gap-8', containerClassName)}
            style={useNativeFlexLayout ? { flex: 1, minHeight: 0 } : undefined}
            onLayout={event => {
              if (!useNativeFlexLayout) {
                dialogHeight.value = event.nativeEvent.layout.height;
              }
            }}
          >
            {hideHeader ? null : hasHeader ? (
              <DialogHeader
                className={cn('flex-row items-center justify-between gap-2', titleClassName)}
              >
                {hasBackButton ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-[50px] w-[50px] rounded-full bg-popover p-0 web:transition-colors web:hover:bg-muted"
                    onPress={onBackPress}
                  >
                    <ArrowLeft color="white" size={20} />
                  </Button>
                ) : (
                  <View className="w-[50px]" />
                )}
                {title ? (
                  <Animated.View
                    key={contentKey}
                    entering={titleEntering}
                    exiting={titleExiting}
                    style={
                      titleIcon ? { flexDirection: 'row', alignItems: 'center', gap: 8 } : undefined
                    }
                  >
                    {titleIcon}
                    <DialogTitle className="native:text-2xl text-xl font-semibold">
                      {title}
                    </DialogTitle>
                  </Animated.View>
                ) : (
                  <View className="flex-1" />
                )}
                <View className="flex-row items-center gap-2">
                  {hasActionButton && actionButton}
                  <DialogCloseButton />
                </View>
              </DialogHeader>
            ) : (
              <View className="flex-row justify-end">
                <DialogCloseButton />
              </View>
            )}
            {disableScroll ? (
              <Animated.View
                entering={contentEntering}
                exiting={contentExiting}
                key={contentKey}
                style={hideHeader || useNativeFlexLayout ? { flex: 1, minHeight: 0 } : undefined}
              >
                {children}
              </Animated.View>
            ) : (
              <View
                className="relative"
                style={useNativeFlexLayout ? { flex: 1, minHeight: 0 } : undefined}
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  enabled={Platform.OS !== 'web'}
                  style={useNativeFlexLayout ? { flex: 1, minHeight: 0 } : undefined}
                >
                  <ScrollView
                    className="web:max-h-[80vh]"
                    contentContainerClassName="pb-4 md:pb-10"
                    // The sheet runs to the bottom edge of the screen, so the last
                    // element (usually the primary button) needs to clear the home
                    // indicator / gesture bar on top of the base pb-4.
                    contentContainerStyle={{
                      ...(useFixedHeightLayout ? { flexGrow: 1 } : null),
                      ...(isNativeSmallScreen ? { paddingBottom: 16 + insets.bottom } : null),
                    }}
                    style={useFixedHeightLayout ? { flex: 1 } : undefined}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
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
                      entering={contentEntering}
                      exiting={contentExiting}
                      key={contentKey}
                    >
                      {children}
                    </Animated.View>
                  </ScrollView>
                </KeyboardAvoidingView>
                {showBottomFade && (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 }}
                  >
                    <LinearGradient
                      colors={[
                        'rgba(16, 16, 16, 0)',
                        'rgba(16, 16, 16, 0.5)',
                        'rgba(16, 16, 16, 1)',
                      ]}
                      locations={[0, 0.6, 1]}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveModal;
