import { Pressable } from 'react-native';
import { router } from 'expo-router';

import ProfileAvatar from '@/components/Profile/ProfileAvatar';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { getUserDisplayName } from '@/lib/utils';

/**
 * Circular profile button for the top-left of the redesigned mobile header.
 * Uses the Figma radial-gradient avatar and opens Settings.
 */
const HeaderProfileButton = () => {
  const { user } = useUser();

  return (
    <Pressable
      accessibilityLabel="Open account settings"
      accessibilityRole="button"
      onPress={() => router.push(path.SETTINGS)}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80 web:hover:opacity-80"
    >
      <ProfileAvatar name={getUserDisplayName(user)} size={50} variant="header" />
    </Pressable>
  );
};

export default HeaderProfileButton;
