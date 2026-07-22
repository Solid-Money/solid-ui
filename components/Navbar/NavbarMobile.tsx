import { type RefObject, useCallback, useEffect } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';

import AccountCenterDropdown from '@/components/AccountCenter/AccountCenterDropdown.native';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';

import HeaderBellButton from './HeaderBellButton';
import HeaderProfileButton from './HeaderProfileButton';
import RegisterButtons from './RegisterButtons';
import WhatsNewButton from './WhatsNewButton';

const GLASS_TRANSITION = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
};

const TITLE_TRANSITION = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

type NavbarMobileProps = {
  blurTarget?: RefObject<View | null>;
  onContentOffsetChange?: (height: number) => void;
  showDivider?: boolean;
  showTitle?: boolean;
  title?: string;
  topInset?: number;
};

const NavbarMobile = ({
  blurTarget,
  onContentOffsetChange,
  showDivider,
  showTitle,
  title,
  topInset = 0,
}: NavbarMobileProps) => {
  const { user } = useUser();
  // Redesigned "glass" header (qa/preview builds): profile moves to the left, the
  // bell (Activity) joins What's-new on the right, and the Solid logo is dropped.
  // Production keeps the existing header untouched.
  const showNewHeader = !!user;
  const hasBlurTarget = !!blurTarget;
  const isGlassVisible = hasBlurTarget && !!showDivider;
  const isTitleVisible = !!title && !!showTitle;
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

  return (
    <View
      className={hasBlurTarget ? 'overflow-hidden' : 'overflow-hidden bg-background'}
      onLayout={handleLayout}
      style={topInset ? { paddingTop: topInset } : undefined}
    >
      {hasBlurTarget && (
        <Animated.View pointerEvents="none" style={[styles.overlay, glassAnimatedStyle]}>
          <BlurView
            {...blurViewProps}
            intensity={56}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
          <View pointerEvents="none" style={[styles.overlay, styles.glassOverlay]} />
        </Animated.View>
      )}
      <View className="flex-row items-center justify-between p-4">
        {showNewHeader ? (
          <HeaderProfileButton />
        ) : (
          <Image
            source={getAsset('images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 30, height: 30 }}
            contentFit="contain"
          />
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
          <View className="flex-row items-center gap-2">
            <WhatsNewButton />
            {showNewHeader ? <HeaderBellButton /> : <AccountCenterDropdown />}
          </View>
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
    backgroundColor: 'rgba(18, 18, 18, 0.66)',
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
