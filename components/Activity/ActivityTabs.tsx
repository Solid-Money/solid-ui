import { useLocalSearchParams, useRouter } from 'expo-router';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { ActivityTab } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
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
  const translateX = useSharedValue(0);
  const width = useSharedValue(0);

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

  const handleLayout = (e: LayoutChangeEvent, element: string, tabValue: ActivityTab) => {
    const { x, width: w } = e.nativeEvent.layout;
    setLayouts(prev => ({
      ...prev,
      [tabValue]: { ...prev[tabValue], [element]: { x, width: w } },
    }));
  };

  const animateUnderline = useCallback(
    (tab: ActivityTab) => {
      if (!layouts[tab]?.[TabElement.TRIGGER] || !layouts[tab]?.[TabElement.TEXT]) return;
      translateX.value = withTiming(
        layouts[tab][TabElement.TRIGGER].x + layouts[tab][TabElement.TEXT].x,
      );
      width.value = withTiming(layouts[tab][TabElement.TEXT].width);
    },
    [layouts, translateX, width],
  );

  const handleTabChange = (newTab: ActivityTab) => {
    router.setParams({ tab: newTab });
  };

  useEffect(() => {
    if (!layouts[tab]?.[TabElement.TRIGGER] || !layouts[tab]?.[TabElement.TEXT]) return;
    animateUnderline(tab);
  }, [animateUnderline, layouts, tab]);

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
