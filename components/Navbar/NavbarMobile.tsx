import HomeQr from '@/assets/images/home-qr';
import PointsNavButton from '@/components/Points/PointsNavButton';
import { path } from '@/constants/path';
import { Link } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { SafeAreaView, View } from 'react-native';

const NavbarMobile = () => {
  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row justify-between items-center p-4">
        <View className="flex-row gap-2 items-center">
          <Link href={path.SETTINGS}>
            <Settings color="#fff" />
          </Link>
          <Link href={path.POINTS} className="-mt-1.5">
            <PointsNavButton />
          </Link>
        </View>
        <Link href={path.SETTINGS}>
          <HomeQr />
        </Link>
      </View>
    </SafeAreaView>
  );
};

export default NavbarMobile;
