import { Href } from 'expo-router';

import { path } from '@/constants/path';
import { isDevFeatureEnabled } from '@/lib/config';

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

// The one nav entry that can't pick a destination up front — a card holder and a
// first-timer need different screens — so it goes through the `/card` redirect
// shim, which branches on card status.
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
  // Stocks is an in-development feature: shown on qa/preview builds, hidden in production.
  const menuItems: MenuItem[] = [
    home,
    savings,
    card,
    ...(isDevFeatureEnabled ? [stocks] : []),
    rewards,
    activity,
  ];
  return { menuItems };
};

export default useNav;
