import { type RefObject, useCallback, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';

import AccountCenterDropdown from '@/components/AccountCenter/AccountCenterDropdown.native';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';

import RegisterButtons from './RegisterButtons';
import WhatsNewButton from './WhatsNewButton';

const GLASS_TRANSITION = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
};

type NavbarMobileProps = {
  blurTarget?: RefObject<View | null>;
  onContentOffsetChange?: (height: number) => void;
  showDivider?: boolean;
  topInset?: number;
};

const NavbarMobile = ({
  blurTarget,
  onContentOffsetChange,
  showDivider,
  topInset = 0,
}: NavbarMobileProps) => {
  const { user } = useUser();
  const hasBlurTarget = !!blurTarget;
  const isGlassVisible = hasBlurTarget && !!showDivider;
  const glassProgress = useSharedValue(isGlassVisible ? 1 : 0);

  useEffect(() => {
    glassProgress.value = withTiming(isGlassVisible ? 1 : 0, GLASS_TRANSITION);
  }, [glassProgress, isGlassVisible]);

  const glassAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glassProgress.value,
  }));
  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glassProgress.value,
  }));

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onContentOffsetChange?.(event.nativeEvent.layout.height);
    },
    [onContentOffsetChange],
  );

  return (
    <View
      className="overflow-hidden bg-background"
      onLayout={handleLayout}
      style={topInset ? { paddingTop: topInset } : undefined}
    >
      {hasBlurTarget && (
        <Animated.View pointerEvents="none" style={[styles.overlay, glassAnimatedStyle]}>
          <BlurView
            blurMethod="dimezisBlurView"
            blurReductionFactor={2.4}
            blurTarget={blurTarget}
            intensity={56}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
          <View pointerEvents="none" style={[styles.overlay, styles.glassOverlay]} />
        </Animated.View>
      )}
      <View className="flex-row items-center justify-between p-4">
        <Image
          source={getAsset('images/solid-logo-4x.png')}
          alt="Solid logo"
          style={{ width: 30, height: 30 }}
          contentFit="contain"
        />
        {user ? (
          <View className="flex-row items-center gap-2">
            <WhatsNewButton />
            <AccountCenterDropdown />
          </View>
        ) : (
          <RegisterButtons />
        )}
        {/* <Link href={path.POINTS} className="-mt-1.5">
          <PointsNavButton />
        </Link> */}
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
