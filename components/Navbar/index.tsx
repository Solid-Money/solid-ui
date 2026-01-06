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
import { getAsset } from '@/lib/assets';
import { NavMenu } from './NavMenu';
import RegisterButtons from './RegisterButtons';
import WhatsNewButton from './WhatsNewButton';

const Navbar = () => {
  const { isScreenMedium } = useDimension();
  const { user } = useUser();

  return (
    <SafeAreaView className="sticky top-0 z-50 border-b border-border/40 bg-background/40 backdrop-blur-lg">
      <View className="mx-auto w-full max-w-7xl flex-row items-center justify-between p-4 md:py-6">
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
            source={getAsset('images/solid-logo.png')}
            alt="Solid logo"
            contentFit="contain"
            style={{ width: 26, height: 30 }}
          />
          <Image
            source={getAsset('images/solid-4x.png')}
            alt="Solid"
            contentFit="contain"
            style={{ width: 72, height: 33, marginTop: -3 }}
            className="mt-[-3px] hidden md:block"
          />
        </Link>
        {user && isScreenMedium && <NavMenu />}
        {user && Platform.OS === 'web' && (
          <View className="flex-row items-center gap-2">
            <WhatsNewButton />
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
