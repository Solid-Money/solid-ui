import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Leaf, Star } from 'lucide-react-native';

import cardAnimation from '@/assets/tabs-icons/card.json';
import { HapticTab } from '@/components/HapticTab';
import { LottieTabIcon } from '@/components/LottieTabIcon';
import { AnimatedTabIcon } from '@/components/tabBar/AnimatedTabIcon';
import { NewCustomTabBar } from '@/components/tabBar/NewCustomTabBar';
import { TabBarBlurProvider } from '@/components/tabBar/TabBarBlurContext';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { isDevFeatureEnabled } from '@/lib/config';

export default function TabLayout() {
  // The desktop sidebar replaces the bottom bar from `isScreenMedium` up (the
  // sidebar shell in `(protected)/_layout.tsx` renders it).
  const { isScreenMedium } = useDimension();

  const tabs = (
    <Tabs
      screenOptions={{
        animation: 'none',
        freezeOnBlur: Platform.OS !== 'web',
        sceneStyle: { backgroundColor: '#0F0F10' },
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
          display: isScreenMedium ? 'none' : 'flex',
          height: 80,
          paddingTop: 4,
          paddingBottom: 20,
          borderTopWidth: 0,
          // Native uses TabBarBackground (BlurView + overlay), web uses CSS backdropFilter
          backgroundColor: Platform.OS === 'web' ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
          borderTopColor: 'rgba(61, 61, 61, 0.0)',
          borderColor: 'rgba(61, 61, 61, 0.0)',
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
      }}
      tabBar={!isScreenMedium ? props => <NewCustomTabBar {...props} /> : undefined}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          lazy: Platform.OS !== 'web' ? false : undefined,
          title: 'Home',
          headerShown: false,

          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon name="wallet" focused={focused} size={size} />
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
            <AnimatedTabIcon name="savings" focused={focused} size={size} />
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
          // The card is part of the wallet page in the redesign, so this tab is
          // filtered out of NewCustomTabBar. The route stays registered because
          // `/card` is the redirect shim old links resolve through.
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
        name="sumsub-kyc"
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
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon name="rewards" focused={focused} size={size} />
          ),
          // Only surface the Rewards tab (and its route) on qa/preview builds;
          // the redesigned NewCustomTabBar renders Wallet/Savings/Rewards.
          href: path.REWARDS,
        }}
      />
      {/* Stocks is an in-development feature: its tab/route is only registered on
          qa/preview builds and hidden in production. The screen itself also
          redirects in production as a deep-link safeguard. */}
      {isDevFeatureEnabled && (
        <Tabs.Screen
          name="stocks"
          options={{
            title: 'Stocks',
            headerShown: false,
            href: path.STOCKS,
          }}
        />
      )}
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

  return <TabBarBlurProvider>{tabs}</TabBarBlurProvider>;
}
