import { Href } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

interface Account {
  title: string;
  description: string;
  icon?: React.ReactNode;
  link: Href;
}

interface Support {
  title: string;
  icon?: React.ReactNode;
  link: Href;
}

export const accounts: Account[] = [
  {
    title: 'Account details',
    description: 'Name & email',
    // description: 'Your profile',
    link: '/settings/account',
  },
];

const supports: Support[] = [
  {
    title: 'Help & Support',
    link: '/settings/help',
  },
  {
    title: 'Legal',
    link: 'https://docs.solid.xyz/terms-and-conditions',
  },
];

// The deposit options modal is not showing on native, so to have a way
// to access the bank transfer page, we add it to the settings page
if (Platform.OS !== 'web') {
  supports.push({
    title: 'Bank transfer',
    link: '/bank-transfer',
  });
}

export { supports };
