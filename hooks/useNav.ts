import { Href } from 'expo-router';

import { path } from '@/constants/path';

type MenuItem = {
  label: string;
  href: Href;
};

const home: MenuItem = {
  label: 'Home',
  href: path.HOME,
};

const savings: MenuItem = {
  label: 'Savings',
  href: path.SAVINGS,
};

const activity: MenuItem = {
  label: 'Activity',
  href: path.ACTIVITY,
};

const points: MenuItem = {
  label: 'Points',
  href: path.POINTS,
};

const card: MenuItem = {
  label: 'Card',
  href: path.CARD,
};

const menuItems: MenuItem[] = [home, savings, card, points, activity];

const useNav = () => {
  return {
    menuItems,
  };
};

export default useNav;
