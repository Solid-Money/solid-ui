import React from 'react';
import { Easing, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SceneStyleInterpolators } from '@react-navigation/bottom-tabs';
import { Leaf, Star } from 'lucide-react-native';

import bellAnimation from '@/assets/tabs-icons/bell.json';
import cardAnimation from '@/assets/tabs-icons/card.json';
import homeAnimation from '@/assets/tabs-icons/home.json';
import lightningAnimation from '@/assets/tabs-icons/lightning.json';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HapticTab } from '@/components/HapticTab';
import { LottieTabIcon } from '@/components/LottieTabIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';

export default function TabLayout() {
  const { isDesktop } = useDimension();

  return (
    <Tabs
      screenOptions={{
        sceneStyleInterpolator: SceneStyleInterpolators.forFade,
        sceneStyle: { backgroundColor: '#121212' },
        transitionSpec: {
          animation: 'timing',
          config: {
            easing: Easing.in(Easing.linear),
          },
        },
        tabBarActiveTintColor: 'white',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        headerShown: false,
        tabBarButton: Platform.OS !== 'web' ? HapticTab : undefined,
        tabBarBackground: Platform.OS !== 'web' ? TabBarBackground : undefined,
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 5,
        },
        tabBarStyle: {
          display: isDesktop ? 'none' : 'flex',
          height: 80,
          paddingTop: 4,
          paddingBottom: 10,
          borderTopWidth: 0,
          // Native uses TabBarBackground (BlurView + overlay), web uses CSS backdropFilter
          backgroundColor: Platform.OS === 'web' ? 'rgba(18, 18, 18, 0.7)' : 'transparent',
          borderTopColor: 'rgba(61, 61, 61, 0.0)',
          borderColor: 'rgba(61, 61, 61, 0.0)',
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
      }}
      tabBar={!isDesktop ? props => <CustomTabBar {...props} /> : undefined}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused }) => <LottieTabIcon source={homeAnimation} focused={focused} />,
          href: path.HOME,
        }}
      />

      <Tabs.Screen
        name="savings"
        options={{
          title: 'Savings',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <LottieTabIcon source={lightningAnimation} focused={focused} />
          ),
          href: path.SAVINGS,
        }}
      />

      <Tabs.Screen
        name="card"
        options={{
          title: 'Card',
          headerShown: false,
          tabBarIcon: ({ focused }) => <LottieTabIcon source={cardAnimation} focused={focused} />,
          href: path.CARD,
        }}
      />

      <Tabs.Screen
        name="card-onboard"
        options={{
          title: 'Card',
          headerShown: false,
          href: null,
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          headerShown: false,
          tabBarIcon: ({ focused }) => <LottieTabIcon source={bellAnimation} focused={focused} />,
          href: path.ACTIVITY,
          // Removed lazy: false - let Activity load on-demand to avoid pre-fetching all pages
        }}
      />

      <Tabs.Screen
        name="bank-transfer"
        options={{
          title: 'Bank Transfer',
          href: null,
        }}
      />

      <Tabs.Screen
        name="user-kyc-info"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="kyc"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="earn"
        options={{
          title: 'Earn',
          tabBarIcon: ({ color }) => <Leaf size={28} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          title: 'Points',
          tabBarIcon: ({ color }) => <Star size={28} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color }) => <Star size={28} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="referral"
        options={{
          title: 'Referral',
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: null,
        }}
      />
      <Tabs.Screen
        name="add-referrer"
        options={{
          title: 'Add Referrer',
          href: null,
        }}
      />
    </Tabs>
  );
}
