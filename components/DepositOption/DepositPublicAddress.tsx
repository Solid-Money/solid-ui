import { Image } from 'expo-image';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';

const DepositPublicAddress = () => {
  const { user } = useUser();

  return (
    <View className="flex items-center justify-center gap-8">
      <View className="bg-primary/10 rounded-xl w-full max-w-md">
        <View className="justify-center items-center px-4 pt-14 pb-4 border-border/50">
          <View className="rounded-xl bg-white p-4">
            <QRCode value={user?.safeAddress} size={200} />
          </View>
        </View>
        <View className="flex-col items-center justify-center gap-2">
          <View className="flex-row items-center gap-1.5 bg-primary/20 px-3 py-1.5 mt-4 rounded-full">
            <Image
              source={require('@/assets/images/fuse-4x.png')}
              style={{ width: 20, height: 20 }}
              contentFit="contain"
            />
            <Text className="text-lg font-medium">Fuse network</Text>
          </View>
          <View className="w-full h-[1px] bg-[#303030] mt-4" />
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-base">
              {user?.safeAddress ? eclipseAddress(user?.safeAddress, 6, 6) : ''}
            </Text>
            <CopyToClipboard text={user?.safeAddress || ''} className="text-primary" />
          </View>
        </View>
      </View>
    </View>
  );
};

export default DepositPublicAddress;
