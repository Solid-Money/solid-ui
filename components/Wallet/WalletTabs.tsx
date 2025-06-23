import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import WalletTokenTab from './WalletTokenTab';

enum Tab {
  TOKENS = "tokens",
  COLLECTIBLES = "collectibles",
  ACTIVITY = "activity",
}

enum TabElement {
  TRIGGER = "trigger",
  TEXT = "text",
}

type TabLayout = {
  [key in TabElement]: {
    x: number;
    width: number;
  }
}

type TabLayouts = Record<string, TabLayout>;

const WalletTabs = () => {
  const [tab, setTab] = useState(Tab.TOKENS);
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
      backgroundColor: 'white'
    };
  });

  const handleLayout = (e: LayoutChangeEvent, element: string, tabValue: Tab) => {
    const { x, width: w } = e.nativeEvent.layout;
    setLayouts(prev => ({ ...prev, [tabValue]: { ...prev[tabValue], [element]: { x, width: w } } }));
  };

  const animateUnderline = useCallback((tab: Tab) => {
    translateX.value = withTiming(
      layouts[tab][TabElement.TRIGGER].x +
      layouts[tab][TabElement.TEXT].x
    );
    width.value = layouts[tab][TabElement.TEXT].width;
  }, [layouts, translateX, width]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
  };

  useEffect(() => {
    if (!layouts[tab]) return;
    animateUnderline(tab);
  }, [animateUnderline, layouts, tab]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => handleTabChange(value as Tab)}
      className='gap-8'
    >
      <TabsList className='flex-row justify-start max-w-sm relative'>
        <Animated.View style={underlineStyle} />
        <TabsTrigger value={Tab.TOKENS} className='px-6 pl-0' onLayout={(e) => handleLayout(e, TabElement.TRIGGER, Tab.TOKENS)}>
          <Text onLayout={(e) => handleLayout(e, TabElement.TEXT, Tab.TOKENS)}>Tokens</Text>
        </TabsTrigger>
        {/* <TabsTrigger value={Tab.COLLECTIBLES} className='px-6' onLayout={(e) => handleLayout(e, TabElement.TRIGGER, Tab.COLLECTIBLES)}>
          <Text onLayout={(e) => handleLayout(e, TabElement.TEXT, Tab.COLLECTIBLES)}>Collectibles</Text>
        </TabsTrigger> */}
        {/* <TabsTrigger value={Tab.ACTIVITY} className='px-6' onLayout={(e) => handleLayout(e, TabElement.TRIGGER, Tab.ACTIVITY)}>
          <Text onLayout={(e) => handleLayout(e, TabElement.TEXT, Tab.ACTIVITY)}>Activity</Text>
        </TabsTrigger> */}
      </TabsList>
      <TabsContent value={Tab.TOKENS}>
        <WalletTokenTab />
      </TabsContent>
    </Tabs>
  );
}

export default WalletTabs;
