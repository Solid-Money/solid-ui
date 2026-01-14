import { Tabs, usePathname } from 'expo-router';
import { Leaf, Star } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import ActivityNavBarIcon from '@/assets/images/activity-nav-bar-icon';
import AssetsNavBarIcon from '@/assets/images/assets-nav-bar-icon';
import CardNavBarIcon from '@/assets/images/card-nav-bar-icon';
import SavingsNavBarIcon from '@/assets/images/savings-nav-bar-icon';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';

export default function TabLayout() {
  const pathname = usePathname();

  const { isDesktop } = useDimension();

  // Check if current route is any card-related route (card/ or card-onboard/)
  const isCardRouteActive = pathname.startsWith('/card') || pathname.startsWith('/card-onboard');

  return (
    <Tabs
      screenOptions={{
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
      tabBar={
        Platform.OS === 'web' && !isDesktop ? props => <CustomTabBar {...props} /> : undefined
      }
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <AssetsNavBarIcon color={color} />,
          href: path.HOME,
        }}
      />

      <Tabs.Screen
        name="savings"
        options={{
          title: 'Savings',
          headerShown: false,
          tabBarIcon: ({ color }) => <SavingsNavBarIcon color={color} />,
          href: path.SAVINGS,
        }}
      />

      <Tabs.Screen
        name="card"
        options={{
          title: 'Card',
          headerShown: false,
          tabBarIcon: ({ color }) => <CardNavBarIcon color={color} isActive={isCardRouteActive} />,
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
          tabBarIcon: ({ color }) => <ActivityNavBarIcon color={color} />,
          href: path.ACTIVITY,
          lazy: false,
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
