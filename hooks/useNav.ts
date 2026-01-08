import { Href } from 'expo-router';
import { useMemo } from 'react';

import { path } from '@/constants/path';
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
  const { data: cardStatus } = useCardStatus();

  const card: MenuItem = useMemo(
    () => ({
      label: 'Card',
      href: cardStatus?.status ? path.CARD_DETAILS : path.CARD_WAITLIST,
    }),
    [cardStatus?.status],
  );

  const menuItems = useMemo<MenuItem[]>(() => {
    return [home, savings, card, points, activity];
  }, [card]);

  return {
    menuItems,
  };
};

export default useNav;
