import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import ProfileIcon from '@/assets/images/profile';
import SettingsIcon from '@/assets/images/settings';
import SignOutIcon from '@/assets/images/sign-out';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { getUserDisplayName } from '@/lib/utils';

const AccountCenterTrigger = (props: any) => {
  const { user } = useUser();

  if (!user?.safeAddress) {
    return <Button size="sm" className="w-full animate-pulse rounded-full" disabled />;
  }

  return (
    <Pressable
      className="web:hover:bg-secondary-hover flex-row items-center justify-between gap-1 rounded-full bg-[#2C2C2C] px-3 py-2 transition-all active:scale-95 active:opacity-80"
      {...props}
    >
      <ProfileIcon width={20} height={20} />
      <ChevronDown size={20} color="white" />
    </Pressable>
  );
};

const AccountCenterUsername = () => {
  const { user } = useUser();
  const displayName = getUserDisplayName(user);
  // Get first character for avatar - prefer email if it's an email-first user
  const avatarChar = (user?.email || user?.username || '?').charAt(0).toUpperCase();

  return (
    <>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-black">
        <Text className="font-semibold text-white">{avatarChar}</Text>
      </View>
      <Text className="font-semibold">{displayName}</Text>
    </>
  );
};

const AccountCenterSettings = () => {
  return (
    <>
      <SettingsIcon width={20} height={20} />
      <Text className="font-semibold">Settings</Text>
    </>
  );
};

const onAccountCenterSettingsPress = () => {
  router.push(path.SETTINGS);
};

const AccountCenterSignOut = () => {
  return (
    <>
      <SignOutIcon width={20} height={20} />
      <Text className="font-semibold">Sign Out</Text>
    </>
  );
};

export {
  AccountCenterSettings,
  AccountCenterSignOut,
  AccountCenterTrigger,
  AccountCenterUsername,
  onAccountCenterSettingsPress,
};
