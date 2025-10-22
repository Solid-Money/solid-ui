import { Tabs } from 'expo-router';
import { ArrowUpDown, CreditCard, Leaf, Plus, Send, Star } from 'lucide-react-native';
import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActivityNavBarIcon from '@/assets/images/activity-nav-bar-icon';
import AssetsNavBarIcon from '@/assets/images/assets-nav-bar-icon';
import SavingsNavBarIcon from '@/assets/images/savings-nav-bar-icon';
import { HapticTab } from '@/components/HapticTab';
import Navbar from '@/components/Navbar';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';

export default function TabLayout() {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const { isDesktop } = useDimension();

  return (
    <SafeAreaView className="bg-background text-foreground flex-1" edges={['right', 'left', 'bottom', 'top']}>
      <ScrollView className="flex-1">
        <Navbar />
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
              paddingBottom: 8,
              borderTopWidth: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              borderTopColor: 'rgba(61, 61, 61, 0.8)',
            },
          }}
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
              href: hasDeposited ? path.SAVINGS : null,
            }}
          />

          <Tabs.Screen
            name="card-waitlist"
            options={{
              title: 'Card',
              headerShown: false,
              tabBarIcon: ({ color }) => <CreditCard size={28} color={color} />,
              href: path.CARD_WAITLIST,
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
            name="swap"
            options={{
              title: 'Swap',
              headerShown: false,
              tabBarIcon: ({ color }) => <ArrowUpDown size={28} color={color} />,
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
            name="send"
            options={{
              title: 'Send',
              tabBarIcon: ({ color }) => <Send size={28} color={color} />,
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
            name="coins"
            options={{
              title: 'Coins',
              href: null,
            }}
          />
        </Tabs>

      </ScrollView>
    </SafeAreaView>
  );
}
