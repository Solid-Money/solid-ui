import { SafeAreaView, View } from 'react-native';
import { AccountCenterTrigger } from '@/components/AccountCenter';

const NavbarMobile = () => {
  return (
    <SafeAreaView className="bg-background">
      <View className="flex-row justify-center items-center p-4">
        <AccountCenterTrigger />
        {/* <Link href={path.POINTS} className="-mt-1.5">
          <PointsNavButton />
        </Link> */}
      </View>
    </SafeAreaView>
  );
};

export default NavbarMobile;
