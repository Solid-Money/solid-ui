import { useLocalSearchParams, useRouter } from 'expo-router';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { ActivityTab } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import ActivityTransactions from './ActivityTransactions';
import CardTransactions from './CardTransactions';
enum TabElement {
  TRIGGER = 'trigger',
  TEXT = 'text',
}

type TabLayout = {
  [key in TabElement]: {
    x: number;
    width: number;
  };
};

type TabLayouts = Record<string, TabLayout>;

const ActivityTabs = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = (params.tab as ActivityTab) || ActivityTab.WALLET;
  const [layouts, setLayouts] = useState<TabLayouts>({});
  const layoutsRef = useRef<TabLayouts>({});
  const translateX = useSharedValue(0);
  const width = useSharedValue(0);
  const isMountedRef = useRef(true);

  // Keep ref in sync with state
  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  const underlineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: width.value,
      position: 'absolute',
      bottom: 0,
      height: 2,
      backgroundColor: 'white',
    };
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent, element: string, tabValue: ActivityTab) => {
      if (!isMountedRef.current) return;
      const { x, width: w } = e.nativeEvent.layout;
      setLayouts(prev => {
        const currentLayout = prev[tabValue]?.[element as TabElement];
        // Only update if layout actually changed to prevent unnecessary re-renders
        if (currentLayout?.x === x && currentLayout?.width === w) {
          return prev;
        }
        const newLayouts = {
          ...prev,
          [tabValue]: { ...prev[tabValue], [element]: { x, width: w } },
        };
        layoutsRef.current = newLayouts;
        return newLayouts;
      });
    },
    [],
  );

  const animateUnderline = useCallback(
    (tabToAnimate: ActivityTab) => {
      if (!isMountedRef.current) return;
      const layout = layoutsRef.current[tabToAnimate];
      if (!layout?.[TabElement.TRIGGER] || !layout?.[TabElement.TEXT]) return;

      const newX = layout[TabElement.TRIGGER].x + layout[TabElement.TEXT].x;
      const newWidth = layout[TabElement.TEXT].width;

      // Only animate if values actually changed
      if (translateX.value !== newX || width.value !== newWidth) {
        translateX.value = withTiming(newX);
        width.value = withTiming(newWidth);
      }
    },
    [translateX, width],
  );

  const handleTabChange = (newTab: ActivityTab) => {
    router.setParams({ tab: newTab });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Create a stable key for the current tab's layout to avoid unnecessary re-renders
  const currentTabLayoutKey = useMemo(() => {
    const layout = layouts[tab];
    if (!layout?.[TabElement.TRIGGER] || !layout?.[TabElement.TEXT]) return null;
    return `${tab}-${layout[TabElement.TRIGGER].x}-${layout[TabElement.TRIGGER].width}-${layout[TabElement.TEXT].x}-${layout[TabElement.TEXT].width}`;
  }, [layouts, tab]);

  // Animate when tab changes or when layouts for current tab become available
  useEffect(() => {
    if (!isMountedRef.current || !currentTabLayoutKey) return;
    animateUnderline(tab);
  }, [tab, currentTabLayoutKey, animateUnderline]);

  return (
    <Tabs
      value={tab}
      onValueChange={value => handleTabChange(value as ActivityTab)}
      className="gap-8"
    >
      <TabsList className="flex-row bg-[#1C1C1E] rounded-[50px] p-1 self-start h-auto">
        <Animated.View style={underlineStyle} />
        <TabsTrigger
          value={ActivityTab.WALLET}
          className={cn(
            'py-3 px-6 rounded-[20px] shadow-none',
            tab === ActivityTab.WALLET ? 'bg-black' : 'bg-transparent',
          )}
          onLayout={e => handleLayout(e, TabElement.TRIGGER, ActivityTab.WALLET)}
        >
          <Text
            className={cn(
              'text-base font-semibold',
              tab === ActivityTab.WALLET ? 'text-white' : 'text-[rgba(255,255,255,0.6)]',
            )}
          >
            Wallet
          </Text>
        </TabsTrigger>
        <TabsTrigger
          value={ActivityTab.CARD}
          className={cn(
            'py-3 px-6 rounded-[20px] shadow-none',
            tab === ActivityTab.CARD ? 'bg-black' : 'bg-transparent',
          )}
          onLayout={e => handleLayout(e, TabElement.TRIGGER, ActivityTab.CARD)}
        >
          <Text
            className={cn(
              'text-base font-semibold',
              tab === ActivityTab.CARD ? 'text-white' : 'text-[rgba(255,255,255,0.6)]',
            )}
          >
            Card
          </Text>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={ActivityTab.WALLET}>
        <ActivityTransactions tab={ActivityTab.WALLET} />
      </TabsContent>
      <TabsContent value={ActivityTab.CARD}>
        <CardTransactions />
      </TabsContent>
    </Tabs>
  );
};

export default ActivityTabs;
