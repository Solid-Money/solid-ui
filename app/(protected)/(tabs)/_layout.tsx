import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Leaf, Star } from 'lucide-react-native';

import bellAnimation from '@/assets/tabs-icons/bell.json';
import cardAnimation from '@/assets/tabs-icons/card.json';
import homeAnimation from '@/assets/tabs-icons/home.json';
import lightningAnimation from '@/assets/tabs-icons/lightning.json';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HapticTab } from '@/components/HapticTab';
import { LottieTabIcon } from '@/components/LottieTabIcon';
import { NewCustomTabBar } from '@/components/tabBar/NewCustomTabBar';
import RewardsTabIcon from '@/components/tabBar/RewardsTabIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';

export default function TabLayout() {
  const { isDesktop } = useDimension();

  return (
    <Tabs
      screenOptions={{
        animation: 'none',
        freezeOnBlur: Platform.OS !== 'web',
        sceneStyle: { backgroundColor: '#121212' },
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
          paddingBottom: 20,
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
      tabBar={!isDesktop ? props => <NewCustomTabBar {...props} /> : undefined}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Home',
          headerShown: false,

          tabBarIcon: ({ focused, size }) => (
            <LottieTabIcon source={homeAnimation} focused={focused} size={size} />
          ),
          href: path.HOME,
        }}
      />

      <Tabs.Screen
        name="savings"
        options={{
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Savings',
          headerShown: false,

          tabBarIcon: ({ focused, size }) => (
            <LottieTabIcon source={lightningAnimation} focused={focused} size={size} />
          ),
          href: path.SAVINGS,
        }}
      />

      <Tabs.Screen
        name="savings-old"
        options={{
          title: 'Savings (old)',
          headerShown: false,
          href: null,
        }}
      />

      <Tabs.Screen
        name="card"
        options={{
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Card',
          headerShown: false,

          tabBarIcon: ({ focused, size }) => (
            <LottieTabIcon source={cardAnimation} focused={focused} size={size} />
          ),
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
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Activity',
          headerShown: false,

          tabBarIcon: ({ focused, size }) => (
            <LottieTabIcon source={bellAnimation} focused={focused} size={size} />
          ),
          href: path.ACTIVITY,
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
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Rewards',
          headerShown: false,
          // Pushed white tier-star image, centered in a full-size box so its
          // icon↔label gap matches the other tabs.
          tabBarIcon: ({ size }) => <RewardsTabIcon size={size ?? 28} />,
          // Only surface the Rewards tab (and its route) on qa/preview builds;
          // the redesigned NewCustomTabBar renders Wallet/Savings/Rewards.
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
