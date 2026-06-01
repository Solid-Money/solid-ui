import { Href } from 'expo-router';

import { path } from '@/constants/path';
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

const agent: MenuItem = {
  label: 'Agent',
  href: path.AGENT,
};

const useNav = () => {
  const points: MenuItem = {
    label: isProduction ? 'Points' : 'Rewards',
    href: isProduction ? path.POINTS : path.REWARDS,
  };
  const menuItems: MenuItem[] = [
    home,
    savings,
    card,
    points,
    // Agent wallet is not yet released to production — hide the tab there.
    ...(isProduction ? [] : [agent]),
    activity,
  ];
  return {
    menuItems,
  };
};

export default useNav;
