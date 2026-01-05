import { Image } from 'expo-image';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountCenterDropdown from '@/components/AccountCenter/AccountCenterDropdown';
import InfoCenterDropdown from '@/components/InfoCenter/InfoCenterDropdown';
import useUser from '@/hooks/useUser';
import RegisterButtons from './RegisterButtons';
import WhatsNewButton from './WhatsNewButton';

const NavbarMobile = () => {
  const { user } = useUser();

  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Image
          source={require('@/assets/images/solid-logo-4x.png')}
          alt="Solid logo"
          style={{ width: 30, height: 30 }}
          contentFit="contain"
        />
        {user ? (
          <View className="flex-row items-center gap-2">
            <WhatsNewButton />
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
