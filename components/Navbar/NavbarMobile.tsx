import HomeQr from '@/assets/images/home-qr';
import { Link } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { SafeAreaView, View } from 'react-native';

import { path } from '@/constants/path';

const NavbarMobile = () => {
  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row justify-between items-center p-4">
        <Link href={path.SETTINGS}>
          <Settings color="#fff" />
        </Link>
        <Link href={path.SETTINGS}>
          <HomeQr />
        </Link>
      </View>
    </SafeAreaView>
  );
};

export default NavbarMobile;
