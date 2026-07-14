import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/** Native: load the TransFi hosted payment page in a WebView. */
export const TransfiPayment = () => {
  const setModal = useDepositStore(state => state.setModal);
  const payUrl = useTransfiStore(state => state.payUrl);

  if (!payUrl) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center text-base text-red-500">
          Could not load the payment page. Please try again.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 gap-3">
      <View className="flex-1 overflow-hidden rounded-2xl">
        <WebView
          source={{ uri: payUrl }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
      <Button
        className="h-12 rounded-2xl"
        variant="secondary"
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS)}
      >
        <Text className="text-base font-semibold text-primary">I&apos;ve completed payment</Text>
      </Button>
    </View>
  );
};

export default TransfiPayment;
