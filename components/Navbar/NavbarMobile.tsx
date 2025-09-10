import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, SafeAreaView, View } from 'react-native';

import UserAvatar from '@/assets/images/user';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { eclipseUsername } from '@/lib/utils';

const NavbarMobile = () => {
  const { user } = useUser();

  const handleAvatarPress = () => {
    router.push(path.SETTINGS);
  };

  if (!user?.safeAddress) {
    return (
      <SafeAreaView className="bg-background">
        <View className="flex-row justify-center items-center p-4">
          <Button size="sm" className="rounded-full animate-pulse" disabled />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row justify-start items-center p-4">
        <Pressable
          onPress={handleAvatarPress}
          className="flex-row items-center justify-between bg-button-secondary rounded-full px-3 py-2 active:scale-95 transition-transform"
        >
          <UserAvatar width={24} height={24} />
          <Text className="text-white font-medium text-sm ml-2 mr-1">
            {user?.username ? eclipseUsername(user.username) : ''}
          </Text>
          <ChevronDown size={16} color="white" />
        </Pressable>
        {/* <Link href={path.POINTS} className="-mt-1.5">
          <PointsNavButton />
        </Link> */}
      </View>
    </SafeAreaView>
  );
};

export default NavbarMobile;
