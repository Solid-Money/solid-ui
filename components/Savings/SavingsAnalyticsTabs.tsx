import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

export enum Tab {
  SAVINGS_RATE = 'savings-rate',
  VAULT_BREAKDOWN = 'vault-breakdown',
}

const ANIMATION_DURATION = 350;

interface SavingsAnalyticsTabsProps {
  selectedTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS_MAX_WIDTH = 400;

const SavingsAnalyticsTabs = ({ selectedTab, onTabChange }: SavingsAnalyticsTabsProps) => {
  const { isScreenMedium } = useDimension();
  const [tabLayouts, setTabLayouts] = useState<Record<Tab, { x: number; width: number }>>({
    [Tab.SAVINGS_RATE]: { x: 0, width: 0 },
    [Tab.VAULT_BREAKDOWN]: { x: 0, width: 0 },
  });

  const tabBackgroundX = useSharedValue(0);
  const tabBackgroundWidth = useSharedValue(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const animateTabBackground = useCallback(
    (tab: Tab) => {
      if (!isMountedRef.current) return;
      const layout = tabLayouts[tab];
      if (!layout || layout.width === 0) return;

      tabBackgroundX.value = withTiming(layout.x, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      tabBackgroundWidth.value = withTiming(layout.width, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    },
    [tabLayouts, tabBackgroundX, tabBackgroundWidth],
  );

  const handleTabLayout = useCallback((event: LayoutChangeEvent, tab: Tab) => {
    if (!isMountedRef.current) return;
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => {
      const currentLayout = prev[tab];
      if (currentLayout?.x === x && currentLayout?.width === width) {
        return prev;
      }
      const newLayouts = { ...prev, [tab]: { x, width } };
      return newLayouts;
    });
  }, []);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      onTabChange(tab);
      animateTabBackground(tab);
    },
    [onTabChange, animateTabBackground],
  );

  useEffect(() => {
    if (!isMountedRef.current) return;
    animateTabBackground(selectedTab);
  }, [selectedTab, tabLayouts, animateTabBackground]);

  const tabBackgroundStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: tabBackgroundX.value }],
      width: tabBackgroundWidth.value,
    }),
    [],
  );

  return (
    <View
      className="relative flex-row gap-2 rounded-full bg-foreground/10 p-[5px]"
      style={{
        width: isScreenMedium ? undefined : '100%',
        maxWidth: isScreenMedium ? TABS_MAX_WIDTH : undefined,
      }}
    >
      <Pressable
        onLayout={e => handleTabLayout(e, Tab.SAVINGS_RATE)}
        onPress={() => handleTabChange(Tab.SAVINGS_RATE)}
        className="relative z-10 flex-1 shrink-0 px-4 py-2 md:flex-none md:px-6"
      >
        <Text
          className="text-center text-base font-semibold text-foreground"
          style={{ opacity: selectedTab === Tab.SAVINGS_RATE ? 1 : 0.6 }}
          numberOfLines={1}
        >
          Savings rate
        </Text>
      </Pressable>
      <Pressable
        onLayout={e => handleTabLayout(e, Tab.VAULT_BREAKDOWN)}
        onPress={() => handleTabChange(Tab.VAULT_BREAKDOWN)}
        className="relative z-10 flex-1 shrink-0 px-4 py-2 md:flex-none md:px-6"
      >
        <Text
          className="text-center text-base font-semibold text-foreground"
          style={{ opacity: selectedTab === Tab.VAULT_BREAKDOWN ? 1 : 0.6 }}
          numberOfLines={1}
        >
          Vault breakdown
        </Text>
      </Pressable>
      <Animated.View
        style={[
          tabBackgroundStyle,
          {
            position: 'absolute',
            top: 4,
            left: 0,
            bottom: 4,
            backgroundColor: 'rgba(17, 17, 17, 1)',
            borderRadius: 100,
            zIndex: 0,
          },
        ]}
      />
    </View>
  );
};

export default SavingsAnalyticsTabs;
