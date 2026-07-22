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

const card: MenuItem = {
  label: 'Card',
  href: path.CARD,
};

const stocks: MenuItem = {
  label: 'Stocks',
  href: path.STOCKS,
};

const useNav = () => {
  const rewards: MenuItem = {
    label: 'Rewards',
    href: path.REWARDS,
  };
  // Agent lives in the account-center menu, not the navbar.
  const menuItems: MenuItem[] = [home, savings, card, stocks, rewards, activity];
  return { menuItems };
};

export default useNav;
