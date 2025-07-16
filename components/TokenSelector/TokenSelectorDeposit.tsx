import { View } from "react-native";
import QRCode from 'react-native-qrcode-svg';

import useUser from "@/hooks/useUser";
import { eclipseAddress } from "@/lib/utils";
import CopyToClipboard from "../CopyToClipboard";
import { Text } from "../ui/text";

const TokenSelectorDeposit = () => {
  const { user } = useUser();

  return (
    <View className="bg-primary/10 rounded-xl">
      <View className="justify-center items-center px-2 py-6 border-b border-border/50">
        <View className="rounded-xl bg-white p-4">
          <QRCode
            value={user?.safeAddress}
            size={200}
          />
        </View>
      </View>
      <View className="flex-row items-center justify-center gap-2 p-2">
        <Text>{user?.safeAddress ? eclipseAddress(user?.safeAddress) : ''}</Text>
        <CopyToClipboard text={user?.safeAddress || ''} className="text-primary" />
      </View>
    </View>
  )
}

export default TokenSelectorDeposit;
