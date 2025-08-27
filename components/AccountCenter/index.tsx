import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import UserAvatar from '@/assets/images/user';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { eclipseAddress, eclipseUsername } from '@/lib/utils';

const AccountCenter = () => {
  const { user } = useUser();

  return (
    <View className="flex-col gap-2 min-h-64">
      <Text className="text-sm text-muted-foreground">Safe Address</Text>
      <View className="flex-row justify-between items-center px-4 py-2 bg-primary/10 rounded-2xl text-primary font-medium">
        <Text>{user?.safeAddress ? eclipseAddress(user?.safeAddress) : ''}</Text>
        <CopyToClipboard text={user?.safeAddress || ''} />
      </View>
    </View>
  );
};

const AccountCenterTrigger = ({ onModalOpen }: { onModalOpen?: () => void }) => {
  const { user } = useUser();

  const handleAvatarPress = () => {
    router.push(path.SETTINGS);
  };

  const handleUsernamePress = () => {
    onModalOpen?.();
  };

  if (!user?.safeAddress) {
    return <Button size="sm" className="w-full rounded-full animate-pulse" disabled />;
  }

  return (
    <Pressable
      onPress={handleUsernamePress}
      className="flex-row items-center justify-between bg-button-secondary rounded-full px-3 py-2 active:scale-95 transition-transform"
    >
      <Pressable onPress={handleAvatarPress} className="active:scale-95 transition-transform">
        <UserAvatar />
      </Pressable>
      <Text className="hidden md:block text-white font-medium text-sm flex-1 text-center">
        {eclipseUsername(user.username)}
      </Text>
      <ChevronDown size={14} color="white" />
    </Pressable>
  );
};

const AccountCenterTitle = () => {
  const { user } = useUser();

  return (
    <Text className="text-lg font-semibold">
      Hello{user?.username ? `, ${user?.username}` : ''}
    </Text>
  );
};

const AccountCenterFooter = () => {
  const { handleLogout } = useUser();

  return (
    <Button variant="destructive" className="w-full" onPress={handleLogout}>
      <Text>Logout</Text>
    </Button>
  );
};

export { AccountCenter, AccountCenterFooter, AccountCenterTitle, AccountCenterTrigger };
