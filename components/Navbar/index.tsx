import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountCenterDropdown from '@/components/AccountCenter/AccountCenterDropdown';
import InfoCenterDropdown from '@/components/InfoCenter/InfoCenterDropdown';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { NavMenu } from './NavMenu';
import RegisterButtons from './RegisterButtons';

const Navbar = () => {
  const { isScreenMedium } = useDimension();
  const { user } = useUser();

  return (
    <SafeAreaView className="sticky top-0 z-50 bg-background/40 backdrop-blur-lg border-b border-border/40">
      <View className="flex-row justify-between items-center p-4 md:py-6 w-full max-w-7xl mx-auto">
        <Link
          href={path.HOME}
          className="flex flex-row items-center gap-2"
          onPress={() => {
            track(TRACKING_EVENTS.NAVBAR_LOGO_CLICKED, {
              source: 'navbar',
            });
          }}
        >
          <Image
            source={require('@/assets/images/solid-logo.png')}
            alt="Solid logo"
            contentFit="contain"
            style={{ width: 26, height: 30 }}
          />
          <Image
            source={require('@/assets/images/solid-4x.png')}
            alt="Solid"
            contentFit="contain"
            style={{ width: 72, height: 33, marginTop: -3 }}
            className="hidden md:block mt-[-3px]"
          />
        </Link>
        {user && isScreenMedium && <NavMenu />}
        {user && Platform.OS === 'web' && (
          <View className="flex-row items-center gap-2">
            <InfoCenterDropdown />
            <AccountCenterDropdown />
          </View>
        )}
        {!user && <RegisterButtons />}
      </View>
    </SafeAreaView>
  );
};

export default Navbar;
