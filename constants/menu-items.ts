import { path } from '@/constants/path';
import { Href } from 'expo-router';

export type MenuItem = {
  label: string;
  href: Href;
};

export const menuItems: MenuItem[] = [
  {
    label: 'Home',
    href: path.HOME,
  },
  {
    label: 'Savings',
    href: path.SAVINGS,
  },
  {
    label: 'Activity',
    href: path.ACTIVITY,
  },
];
