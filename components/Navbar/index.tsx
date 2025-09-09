import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Platform, SafeAreaView, View } from 'react-native';

import AccountCenterModal from '@/components/AccountCenter/AccountCenterModal';
import { path } from '@/constants/path';
import { NavMenu } from './NavMenu';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/firebase';

const Navbar = () => {
  const { isScreenMedium } = useDimension();

  return (
    <SafeAreaView className="sticky top-0 z-50 bg-background/10 backdrop-blur-lg border-b border-border/40">
      <View className="flex-row justify-between items-center p-4 md:py-6 w-full max-w-7xl mx-auto">
        <Link
          href={path.HOME}
          className="flex flex-row items-center gap-2"
          onPress={() => {
            track('navbar_logo_clicked', {
              source: 'navbar',
            });
          }}
        >
          <Image
            source={require('@/assets/images/solid-logo.png')}
            alt="Solid logo"
            contentFit="contain"
            style={{ width: 20, height: 20 }}
          />
          <Image
            source={require('@/assets/images/solid-4x.png')}
            alt="Solid"
            contentFit="contain"
            style={{ width: 68, height: 23 }}
            className="hidden md:block"
          />
        </Link>
        {isScreenMedium && <NavMenu />}
        {Platform.OS === 'web' && <AccountCenterModal />}
      </View>
    </SafeAreaView>
  );
};

export default Navbar;
