import { Pressable } from 'react-native';
import { router } from 'expo-router';

import ProfileIcon from '@/assets/images/profile';
import { path } from '@/constants/path';

/**
 * Circular profile button for the top-left of the whitelisted mobile header.
 * Icon-only (no chevron) to mirror the bell button on the right. Opens Settings.
 */
const HeaderProfileButton = () => {
  return (
    <Pressable
      accessibilityLabel="Open account settings"
      accessibilityRole="button"
      onPress={() => router.push(path.SETTINGS)}
      className="h-9 w-9 items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <ProfileIcon width={16} height={20} />
    </Pressable>
  );
};

export default HeaderProfileButton;
