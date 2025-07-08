import { Tabs } from 'expo-router';
import { CreditCard, LayoutDashboard, Leaf, Plus } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "white",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {
            backgroundColor: "#262626",
            borderColor: "#686163",
            display: Platform.OS === 'web' ? 'none' : 'flex',
          },
        }),
      }}
      backBehavior="order"
    >
      {/* <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <House size={28} color={color} />,
            href: path.HOME,
          }}
        /> */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Savings',
          headerShown: false,
          tabBarIcon: ({ color }) => <LayoutDashboard size={28} color={color} />,
          href: path.HOME,
        }}
      />

      <Tabs.Screen
        name="deposit"
        options={{
          title: 'Deposit',
          headerShown: false,
          tabBarIcon: ({ color }) => <Plus size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: 'Card',
          tabBarIcon: ({ color }) => <CreditCard size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: 'Earn',
          tabBarIcon: ({ color }) => <Leaf size={28} color={color} />,
          href: Platform.OS === 'web' ? null : path.EARN,
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
          href: null,
        }}
      />
    </Tabs>
  );
}
