import { Tabs } from 'expo-router';
import { CreditCard, Leaf, Star } from 'lucide-react-native';
import React from 'react';

import ActivityNavBarIcon from '@/assets/images/activity-nav-bar-icon';
import AssetsNavBarIcon from '@/assets/images/assets-nav-bar-icon';
import CardNavBarIcon from '@/assets/images/card-nav-bar-icon';
import SavingsNavBarIcon from '@/assets/images/savings-nav-bar-icon';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { CardStatus } from '@/lib/types';

export default function TabLayout() {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;
  const { data: cardStatus } = useCardStatus();

  const { isDesktop } = useDimension();

  const cardHref =
    cardStatus?.status === CardStatus.ACTIVE || cardStatus?.status === CardStatus.FROZEN
      ? path.CARD_DETAILS
      : path.CARD_WAITLIST;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'white',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 5,
        },
        tabBarStyle: {
          display: isDesktop ? 'none' : 'flex',
          height: 75,
          paddingTop: 6,
          paddingBottom: 5,
          borderTopWidth: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderTopColor: 'rgba(61, 61, 61, 0.8)',
          borderColor: 'rgba(61, 61, 61, 0.8)',
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
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
        name="card-onboard"
        options={{
          title: 'Card',
          headerShown: false,
          tabBarIcon: ({ color }) => <CardNavBarIcon color={color} />,
          href: cardHref,
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
