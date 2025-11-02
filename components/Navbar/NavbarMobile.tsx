import { Image } from 'expo-image';
import { SafeAreaView, View } from 'react-native';

import useUser from '@/hooks/useUser';
import RegisterButtons from './RegisterButtons';
import InfoCenterDropdown from '@/components/InfoCenter/InfoCenterDropdown';
import AccountCenterDropdown from '@/components/AccountCenter/AccountCenterDropdown';

const NavbarMobile = () => {
  const { user } = useUser();

  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row justify-between items-center p-4">
        <Image
          source={require('@/assets/images/solid-logo-4x.png')}
          alt="Solid logo"
          style={{ width: 30, height: 30 }}
          contentFit="contain"
        />
        {user ? (
          <View className="flex-row items-center gap-2">
            <InfoCenterDropdown />
            <AccountCenterDropdown />
          </View>
        ) : (
          <RegisterButtons />
        )}
        {/* <Link href={path.POINTS} className="-mt-1.5">
          <PointsNavButton />
        </Link> */}
      </View>
    </SafeAreaView>
  );
};

export default NavbarMobile;
