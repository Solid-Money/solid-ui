import { Href } from 'expo-router';
import { useMemo } from 'react';

import { path } from '@/constants/path';
import useUser from './useUser';

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

const card: MenuItem = {
  label: 'Card',
  href: path.CARD_WAITLIST,
};

const activity: MenuItem = {
  label: 'Activity',
  href: path.ACTIVITY,
};

const useNav = () => {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const menuItems = useMemo<MenuItem[]>(() => {
    if (hasDeposited) {
      return [home, savings, card, activity];
    }
    return [home, card, activity];
  }, [hasDeposited]);

  return {
    menuItems,
  };
};

export default useNav;
