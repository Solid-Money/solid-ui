import { Href } from 'expo-router';
import { Platform } from 'react-native';

interface Account {
  title: string;
  description: string;
  link: Href;
}

interface Support {
  title: string;
  link: Href;
}

export const accounts: Account[] = [
  {
    title: 'Account details',
    description: 'Name & email',
    link: '/settings/account',
  },
  {
    title: 'Wallet recovery',
    description: 'Secure your account',
    link: '/settings/account',
  },
];

const supports: Support[] = [
  {
    title: 'Help & Support',
    link: '/settings/account',
  },
  {
    title: 'Legal',
    link: '/settings/account',
  },
  {
    title: 'Rate us',
    link: '/settings/account',
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
