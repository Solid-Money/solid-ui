import { Href } from 'expo-router';

import { path } from '@/constants/path';
import { useIsTestUser } from '@/hooks/useIsTestUser';
import { isProduction } from '@/lib/config';

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
  const isTestUser = useIsTestUser();
  const points: MenuItem = {
    label: isProduction ? 'Points' : 'Rewards',
    href: isProduction ? path.POINTS : path.REWARDS,
  };
  // Agent lives in the account-center menu, not the navbar.
  const menuItems: MenuItem[] = [
    home,
    savings,
    card,
    ...(isTestUser ? [stocks] : []),
    points,
    activity,
  ];
  return { menuItems };
};

export default useNav;
