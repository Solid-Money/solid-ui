import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';

import TabBarBackground from '@/components/ui/TabBarBackground';
import { Text } from '@/components/ui/text';
import { WHITELIST_TAB_LABELS, WHITELIST_TAB_NAMES } from '@/constants/tabs';

// These mirror CustomTabBar so the whitelisted bar keeps the same footprint /
// safe-area behavior as the public one. See CustomTabBar.tsx for the rationale.
const TAB_BAR_CONTENT_HEIGHT = 45;
const TAB_BAR_MIN_BOTTOM_INSET = 35;
const TAB_BAR_ANDROID_EXTRA_INSET = 16;
const TAB_BAR_PADDING_TOP = 10;

const ACTIVE_TAB_COLOR = 'white';
const INACTIVE_TAB_COLOR = 'rgba(255, 255, 255, 0.5)';

// The sliding "oval glass" background sits behind the active tab, inset from the
// measured tab slot so it reads as a pill rather than a full-width block.
const PILL_INSET_X = 8;
const PILL_INSET_Y = 2;

// Matches NavbarMobile's GLASS_TRANSITION so the app's glass motion feels of a piece.
const SLIDE_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };
const VISIBLE_TAB_NAMES = WHITELIST_TAB_NAMES as readonly string[];

type TabLayout = { x: number; y: number; width: number; height: number };

type TabButtonProps = {
  label: string;
  icon: React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

function TabButton({ label, icon, isFocused, onPress, onLongPress, onLayout }: TabButtonProps) {
  const [pressed, setPressed] = useState(false);
  const labelColor = isFocused ? ACTIVE_TAB_COLOR : INACTIVE_TAB_COLOR;

  const handlePressIn = () => {
    setPressed(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  const handlePressOut = () => setPressed(false);

  const pressStyle =
    Platform.OS === 'web'
      ? ({
          transition: 'transform 120ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms ease-in-out',
          transform: pressed ? 'scale(0.92)' : 'scale(1)',
          opacity: pressed ? 0.85 : 1,
        } as ViewStyle)
      : ({ opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] } as ViewStyle);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={onLayout}
      style={styles.tabButton}
    >
      <View style={[styles.tabContent, pressStyle]}>
        <View style={[styles.iconWrapper, { opacity: isFocused ? 1 : 0.5 }]}>{icon}</View>
        <Text style={[styles.tabLabel, { color: labelColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Whitelisted "glass" bottom tab bar. Identical navigation semantics to
 * CustomTabBar (route filtering, originalIndex/isFocused mapping, tabPress →
 * CommonActions.navigate) plus a sliding oval glass indicator that animates
 * from the previously active tab to the tapped one.
 */
export function NewCustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;

  const bottomInset = Math.max(
    insets.bottom + (Platform.OS === 'android' ? TAB_BAR_ANDROID_EXTRA_INSET : 0),
    TAB_BAR_MIN_BOTTOM_INSET,
  );

  const visibleRoutes = useMemo(
    () => state.routes.filter(route => VISIBLE_TAB_NAMES.includes(route.name)),
    [state.routes],
  );

  // Index within visibleRoutes of the currently focused tab.
  const activeVisibleIndex = visibleRoutes.findIndex(
    route => state.routes.findIndex(r => r.key === route.key) === state.index,
  );

  const [layouts, setLayouts] = useState<Record<number, TabLayout>>({});
  const layoutsRef = useRef<Record<number, TabLayout>>({});

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillHeight = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const hasPositionedRef = useRef(false);

  // Re-jump (no animation) after an account switch collapses the layout cache.
  useEffect(() => {
    if (Object.keys(layouts).length === 0) {
      hasPositionedRef.current = false;
    }
  }, [layouts]);

  const setLayoutFor = useCallback((visibleIndex: number, layout: TabLayout) => {
    setLayouts(prev => {
      const existing = prev[visibleIndex];
      if (
        existing &&
        existing.x === layout.x &&
        existing.y === layout.y &&
        existing.width === layout.width &&
        existing.height === layout.height
      ) {
        return prev;
      }
      const next = { ...prev, [visibleIndex]: layout };
      layoutsRef.current = next;
      return next;
    });
  }, []);

  // Position / animate the oval when the active tab changes or its layout arrives.
  useEffect(() => {
    if (activeVisibleIndex < 0) return;
    const layout = layouts[activeVisibleIndex];
    if (!layout) return;

    const targetX = layout.x + PILL_INSET_X;
    const targetY = layout.y + PILL_INSET_Y;
    const targetWidth = Math.max(layout.width - PILL_INSET_X * 2, 0);
    const targetHeight = Math.max(layout.height - PILL_INSET_Y * 2, 0);

    // Vertical size/position is constant across tabs — set without animation.
    translateY.value = targetY;
    pillHeight.value = targetHeight;

    if (!hasPositionedRef.current) {
      // First paint: jump into place, then fade in, so the pill never slides
      // in from x=0 on mount.
      translateX.value = targetX;
      pillWidth.value = targetWidth;
      pillOpacity.value = withTiming(1, { duration: 160 });
      hasPositionedRef.current = true;
    } else {
      translateX.value = withTiming(targetX, SLIDE_TIMING);
      pillWidth.value = withTiming(targetWidth, SLIDE_TIMING);
    }
  }, [activeVisibleIndex, layouts, translateX, translateY, pillWidth, pillHeight, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    width: pillWidth.value,
    height: pillHeight.value,
    opacity: pillOpacity.value,
  }));

  if (currentRouteName === 'settings') {
    return null;
  }

  return (
    <View
      style={[
        styles.tabBar,
        { height: TAB_BAR_CONTENT_HEIGHT + bottomInset, paddingBottom: bottomInset },
      ]}
    >
      {TabBarBackground && <TabBarBackground />}
      <View style={styles.row}>
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        {visibleRoutes.map((route, visibleIndex) => {
          const { options } = descriptors[route.key];
          const originalIndex = state.routes.findIndex(r => r.key === route.key);

          const label = WHITELIST_TAB_LABELS[route.name] ?? options.title ?? route.name;
          const isFocused = state.index === originalIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate(route),
                target: state.key,
              });
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: ACTIVE_TAB_COLOR,
            size: Platform.OS === 'web' ? 30 : 34,
          });

          return (
            <TabButton
              key={route.key}
              label={label}
              icon={icon}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              onLayout={e => {
                const { x, y, width, height } = e.nativeEvent.layout;
                setLayoutFor(visibleIndex, { x, y, width, height });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: TAB_BAR_PADDING_TOP,
    backgroundColor: Platform.OS === 'web' ? 'rgba(18, 18, 18, 0.7)' : 'transparent',
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    // @ts-ignore - web CSS
    backdropFilter: Platform.OS === 'web' ? 'blur(10px)' : undefined,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: -2,
  },
});
