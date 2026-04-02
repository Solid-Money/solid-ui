import { View } from 'react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import SolidQRCode from '@/components/SolidQRCode';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';

const DepositPublicAddress = () => {
  const { user } = useUser();

  return (
    <View className="flex items-center justify-center gap-8">
      <View className="w-full max-w-md rounded-xl bg-primary/10">
        <View className="items-center justify-center border-border/50 px-4 pb-4 pt-14">
          <View className="overflow-hidden rounded-xl">
            <SolidQRCode value={user?.safeAddress || ''} size={200} />
          </View>
        </View>
        <View className="flex-col items-center justify-center gap-2">
          <View className="mt-4 h-[1px] w-full bg-[#303030]" />
          <View className="mb-2 flex-row items-center gap-2">
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
