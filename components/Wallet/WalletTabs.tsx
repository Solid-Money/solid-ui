import { useCallback, useEffect, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import WalletTokenTab from './WalletTokenTab';

enum Tab {
  TOKENS = 'tokens',
  COLLECTIBLES = 'collectibles',
  ACTIVITY = 'activity',
}

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

const WalletTabs = () => {
  const [tab, setTab] = useState(Tab.TOKENS);
  const [layouts] = useState<TabLayouts>({});
  const translateX = useSharedValue(0);
  const width = useSharedValue(0);

  // const underlineStyle = useAnimatedStyle(() => {
  //   return {
  //     transform: [{ translateX: translateX.value }],
  //     width: width.value,
  //     position: 'absolute',
  //     bottom: 0,
  //     height: 2,
  //     backgroundColor: 'white',
  //   };
  // });

  // const handleLayout = (e: LayoutChangeEvent, element: string, tabValue: Tab) => {
  //   const { x, width: w } = e.nativeEvent.layout;
  //   setLayouts(prev => ({
  //     ...prev,
  //     [tabValue]: { ...prev[tabValue], [element]: { x, width: w } },
  //   }));
  // };

  const animateUnderline = useCallback(
    (tab: Tab) => {
      translateX.value = withTiming(
        layouts[tab][TabElement.TRIGGER].x + layouts[tab][TabElement.TEXT].x,
      );
      width.value = layouts[tab][TabElement.TEXT].width;
    },
    [layouts, translateX, width],
  );

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
  };

  useEffect(() => {
    if (!layouts[tab]) return;
    animateUnderline(tab);
  }, [animateUnderline, layouts, tab]);

  return (
    <Tabs value={tab} onValueChange={value => handleTabChange(value as Tab)} className="gap-8">
      <TabsContent value={Tab.TOKENS}>
        <WalletTokenTab />
      </TabsContent>
    </Tabs>
  );
};

export default WalletTabs;
