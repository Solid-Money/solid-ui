import { Href } from 'expo-router';
import { useMemo } from 'react';

import { path } from '@/constants/path';
import useUser from './useUser';
import { useCardStatus } from './useCardStatus';

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

const useNav = () => {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;
  const { data: cardStatus } = useCardStatus();

  const card: MenuItem = useMemo(
    () => ({
      label: 'Card',
      href: cardStatus?.status ? path.CARD_DETAILS : path.CARD_WAITLIST,
    }),
    [cardStatus?.status],
  );

  const menuItems = useMemo<MenuItem[]>(() => {
    if (hasDeposited) {
      return [home, savings, card, points, activity];
    }
    return [home, card, points, activity];
  }, [hasDeposited, card]);

  return {
    menuItems,
  };
};

export default useNav;
