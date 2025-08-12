import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import ActivityTransactions from './ActivityTransactions';
import { ActivityTab } from '@/lib/types';

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
  const [tab, setTab] = useState(ActivityTab.ALL);
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
      translateX.value = withTiming(
        layouts[tab][TabElement.TRIGGER].x + layouts[tab][TabElement.TEXT].x,
      );
      width.value = layouts[tab][TabElement.TEXT].width;
    },
    [layouts, translateX, width],
  );

  const handleTabChange = (newTab: ActivityTab) => {
    setTab(newTab);
  };

  useEffect(() => {
    if (!layouts[tab]) return;
    animateUnderline(tab);
  }, [animateUnderline, layouts, tab]);

  return (
    <Tabs
      value={tab}
      onValueChange={value => handleTabChange(value as ActivityTab)}
      className="gap-8"
    >
      <TabsList className="flex-row justify-start max-w-sm relative">
        <Animated.View style={underlineStyle} />
        <TabsTrigger
          value={ActivityTab.ALL}
          className="px-6 pl-0"
          onLayout={e => handleLayout(e, TabElement.TRIGGER, ActivityTab.ALL)}
        >
          <Text onLayout={e => handleLayout(e, TabElement.TEXT, ActivityTab.ALL)}>
            All activity
          </Text>
        </TabsTrigger>
        <TabsTrigger
          value={ActivityTab.PROGRESS}
          className="px-6 pl-0"
          onLayout={e => handleLayout(e, TabElement.TRIGGER, ActivityTab.PROGRESS)}
        >
          <Text onLayout={e => handleLayout(e, TabElement.TEXT, ActivityTab.PROGRESS)}>
            In progress
          </Text>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={ActivityTab.ALL}>
        <ActivityTransactions tab={ActivityTab.ALL} />
      </TabsContent>
      <TabsContent value={ActivityTab.PROGRESS}>
        <ActivityTransactions tab={ActivityTab.PROGRESS} />
      </TabsContent>
    </Tabs>
  );
};

export default ActivityTabs;
