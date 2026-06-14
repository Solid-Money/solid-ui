import { View } from 'react-native';
import LottieView from 'lottie-react-native';

import { FAQ } from '@/components/FAQ';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import passkeyFaqs from '@/constants/passkey-faqs';

const MODAL_STATE: ModalState = { name: 'passkey-faq', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

interface PasskeyFaqModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PasskeyFaqModal = ({ isOpen, onOpenChange }: PasskeyFaqModalProps) => {
  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={null}
      contentKey="passkey-faq"
      contentClassName="md:max-w-[40rem] md:px-4 md:pt-4"
      containerClassName="gap-0"
      shouldAnimate={false}
    >
      <View>
        <View className="items-center">
          <LottieView
            source={require('@/assets/animations/vault.json')}
            autoPlay
            loop
            style={{ width: 140, height: 140 }}
            resizeMode="contain"
          />
        </View>
        <View className="gap-6">
          <Text className="native:text-2xl text-xl font-semibold">Passkey FAQ</Text>
          <FAQ faqs={passkeyFaqs} />
        </View>
      </View>
    </ResponsiveModal>
  );
};

export default PasskeyFaqModal;
