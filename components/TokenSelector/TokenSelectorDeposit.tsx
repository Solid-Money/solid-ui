import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';

const TokenSelectorDeposit = () => {
  const { user } = useUser();

  return (
    <View className="rounded-xl bg-primary/10">
      <View className="items-center justify-center border-b border-border/50 px-2 py-6">
        <View className="rounded-xl bg-white p-4">
          <QRCode value={user?.safeAddress} size={200} />
        </View>
      </View>
      <View className="flex-row items-center justify-center gap-2 p-2">
        <Text className="text-base">
          {user?.safeAddress ? eclipseAddress(user?.safeAddress) : ''}
        </Text>
        <CopyToClipboard text={user?.safeAddress || ''} className="text-primary" />
      </View>
    </View>
  );
};

export default TokenSelectorDeposit;
