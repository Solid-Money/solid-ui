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

const agent: MenuItem = {
  label: 'Agent',
  href: path.AGENT,
};

// The new rewards program is not launched yet, so the nav points to the
// legacy Points page in all environments. To launch rewards, point this back
// to path.REWARDS (the /rewards route and opt-in popup remain in the app).
const points: MenuItem = {
  label: 'Points',
  href: path.POINTS,
};

const useNav = () => {
  const menuItems: MenuItem[] = [home, savings, card, points, agent, activity];
  return {
    menuItems,
  };
};

export default useNav;
