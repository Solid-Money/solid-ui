import { Pressable } from 'react-native';
import { router } from 'expo-router';

import HeaderBellIcon from '@/assets/images/header-bell';
import { path } from '@/constants/path';

/**
 * Circular bell button shown in the top-right of the redesigned mobile header.
 * Replaces the Activity bottom tab as the entry point to the Activity feed.
 * Styling matches WhatsNewButton / AccountCenterTrigger.
 */
const HeaderBellButton = () => {
  return (
    <Pressable
      accessibilityLabel="Open activity"
      accessibilityRole="button"
      onPress={() => router.push(path.ACTIVITY)}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <HeaderBellIcon />
    </Pressable>
  );
};

export default HeaderBellButton;
