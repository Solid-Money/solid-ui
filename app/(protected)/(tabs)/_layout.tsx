import { Tabs } from 'expo-router';
import { CreditCard, Leaf, Send, Wallet, Plus } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import ActivityNavBarIcon from '@/assets/images/activity-nav-bar-icon';
import AssetsNavBarIcon from '@/assets/images/assets-nav-bar-icon';
import SavingsNavBarIcon from '@/assets/images/savings-nav-bar-icon';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { useDimension } from '@/hooks/useDimension';

export default function TabLayout() {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const { isDesktop } = useDimension();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'white',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarStyle: {
          display: isDesktop ? 'none' : 'flex',
          height: 85,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
            },
            default: {
              backgroundColor: '#161616',
              borderColor: '#3D3D3D',
            },
          }),
        },
      }}
      backBehavior="order"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Assets',
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
        name="activity"
        options={{
          title: 'Activity',
          headerShown: false,
          tabBarIcon: ({ color }) => <ActivityNavBarIcon color={color} />,
          href: path.ACTIVITY,
        }}
      />

      <Tabs.Screen
        name="deposit"
        options={{
          title: 'Deposit',
          headerShown: false,
          tabBarIcon: ({ color }) => <Plus size={28} color={color} />,
          href: null,
        }}
      />

      <Tabs.Screen
        name="card"
        options={{
          title: 'Card',
          tabBarIcon: ({ color }) => <CreditCard size={28} color={color} />,
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
        name="buy-crypto/index"
        options={{
          title: 'Buy Crypto',
          href: null,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color }) => <Wallet size={28} color={color} />,
          href: hasDeposited ? path.WALLET : null,
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          title: 'Send',
          tabBarIcon: ({ color }) => <Send size={28} color={color} />,
          href: hasDeposited ? path.SEND : null,
        }}
      />
    </Tabs>
  );
}
