import { type RefObject, useCallback, useEffect } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import HeaderBellButton from './HeaderBellButton';
import HeaderHelpButton from './HeaderHelpButton';
import HeaderProfileButton from './HeaderProfileButton';
import RegisterButtons from './RegisterButtons';

const GLASS_TRANSITION = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
};

const TITLE_TRANSITION = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

// The 50px action buttons use -3px vertical margins inside a row with 16px
// padding: 50 - 6 + 32 = 76. PageLayout uses this before onLayout fires so
// scrolling content never renders underneath the overlaid header for one frame.
export const MOBILE_NAVBAR_CONTENT_HEIGHT = 76;

// A nested backdrop filter cannot sample through the opacity-animated parent on
// web, so keep the web filter on that parent itself. Native continues to use
// BlurView below, including the Android blur target.
const WEB_GLASS_BLUR =
  Platform.OS === 'web'
    ? {
        backgroundColor: 'rgba(17, 17, 17, 0.6)',
        backdropFilter: 'saturate(180%) blur(11.2px)',
        WebkitBackdropFilter: 'saturate(180%) blur(11.2px)',
      }
    : undefined;

type NavbarMobileProps = {
  blurTarget?: RefObject<View | null>;
  onContentOffsetChange?: (height: number) => void;
  showDivider?: boolean;
  showTitle?: boolean;
  title?: string;
  topInset?: number;
  /** Left-side action shown for signed-in users. */
  leftAction?: 'profile' | 'back';
  /** Right-side action shown for signed-in users. 'help' replaces the bell with a single "?" button. */
  rightAction?: 'default' | 'help' | 'none';
  onHelpPress?: () => void;
  /**
   * Animate the left/right buttons out while a card hero transition runs. Only the
   * home screen opts in — it's the screen the card flies away from.
   */
  animateCardHeroExit?: boolean;
};

const NavbarMobile = ({
  blurTarget,
  onContentOffsetChange,
  showDivider,
  showTitle,
  title,
  topInset = 0,
  leftAction = 'profile',
  rightAction = 'default',
  onHelpPress,
  animateCardHeroExit = false,
}: NavbarMobileProps) => {
  const { user } = useUser();
  // On the screen the card flies away from, the whole navbar has to clear out — not
  // just its buttons. The card-details pane draws over this screen with no
  // background of its own, so a scrolled-in glass backdrop and balance title would
  // otherwise sit behind (and collide with) the pane's own header and title.
  const isCardPaneOpen = useCardPaneStore(state => state.isOpen);
  const isHeroExiting = animateCardHeroExit && isCardPaneOpen;
  // Redesigned "glass" header: profile stays on the left, Activity stays on the
  // right, and transient content such as What's-new scrolls beneath this layer.
  const hasBlurTarget = !!blurTarget;
  const isGlassVisible = hasBlurTarget && !!showDivider && !isHeroExiting;
  const isTitleVisible = !!title && !!showTitle && !isHeroExiting;
  const blurViewProps =
    Platform.OS === 'android'
      ? {
          blurMethod: 'dimezisBlurView' as const,
          blurReductionFactor: 2.4,
          blurTarget,
        }
      : {};
  const glassProgress = useSharedValue(isGlassVisible ? 1 : 0);
  const titleProgress = useSharedValue(isTitleVisible ? 1 : 0);

  useEffect(() => {
    glassProgress.value = withTiming(isGlassVisible ? 1 : 0, GLASS_TRANSITION);
  }, [glassProgress, isGlassVisible]);

  useEffect(() => {
    titleProgress.value = withTiming(isTitleVisible ? 1 : 0, TITLE_TRANSITION);
  }, [isTitleVisible, titleProgress]);

  const glassAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glassProgress.value,
  }));
  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glassProgress.value,
  }));
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [
      { translateY: (1 - titleProgress.value) * 6 },
      { scale: 0.96 + titleProgress.value * 0.04 },
    ],
  }));

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onContentOffsetChange?.(event.nativeEvent.layout.height);
    },
    [onContentOffsetChange],
  );

  const rightActionButton =
    rightAction === 'none' ? null : rightAction === 'help' ? (
      <HeaderHelpButton onPress={() => onHelpPress?.()} />
    ) : (
      <HeaderBellButton />
    );
  const leftActionButton =
    leftAction === 'back' ? <BackButton variant="header" /> : <HeaderProfileButton />;

  return (
    <View
      className={hasBlurTarget ? 'overflow-hidden' : 'overflow-hidden bg-background'}
      onLayout={handleLayout}
      pointerEvents="box-none"
      style={topInset ? { paddingTop: topInset } : undefined}
    >
      {hasBlurTarget && (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, WEB_GLASS_BLUR, glassAnimatedStyle]}
        >
          {Platform.OS !== 'web' && (
            <BlurView
              {...blurViewProps}
              intensity={56}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              tint="systemChromeMaterialDark"
            />
          )}
          {Platform.OS !== 'web' && (
            <View pointerEvents="none" style={[styles.overlay, styles.glassOverlay]} />
          )}
        </Animated.View>
      )}
      <View className="flex-row items-center justify-between p-4" pointerEvents="box-none">
        {animateCardHeroExit ? (
          <HeroExit spec={HERO_EXIT.headerLeft}>{leftActionButton}</HeroExit>
        ) : (
          leftActionButton
        )}
        {!!title && (
          <Animated.View
            accessibilityElementsHidden={!isTitleVisible}
            importantForAccessibility={isTitleVisible ? 'auto' : 'no-hide-descendants'}
            pointerEvents="none"
            style={[styles.title, titleAnimatedStyle]}
          >
            <Text className="text-xl font-semibold text-white" numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
        )}
        {user ? (
          !rightActionButton ? null : animateCardHeroExit ? (
            <HeroExit spec={HERO_EXIT.headerRight} className="flex-row items-center gap-2">
              {rightActionButton}
            </HeroExit>
          ) : (
            <View className="flex-row items-center gap-2">{rightActionButton}</View>
          )
        ) : (
          <RegisterButtons />
        )}
      </View>
      <Animated.View pointerEvents="none" style={[styles.divider, dividerAnimatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glassOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
  },
  title: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 72,
    position: 'absolute',
    right: 72,
    top: 0,
  },
  divider: {
    backgroundColor: 'rgba(102, 99, 101, 0.28)',
    bottom: 0,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});

export default NavbarMobile;
