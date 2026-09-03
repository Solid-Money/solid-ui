import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { DigitalWalletType } from '@/constants/digital-wallet';

interface AddToWalletModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Tab to show first. Apple by default, as before; an Android user sent here by
   * the home "Add to Google Wallet" banner needs Google's steps, not Apple's.
   */
  initialWallet?: DigitalWalletType;
}

const MODAL_STATE: ModalState = { name: 'add-to-wallet', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

export default function AddToWalletModal({
  trigger,
  isOpen,
  onOpenChange,
  initialWallet = DigitalWalletType.Apple,
}: AddToWalletModalProps) {
  const [activeTab, setActiveTab] = useState<DigitalWalletType>(initialWallet);

  // The modal is mounted for the life of the screen, so the requested tab has to
  // be applied on each open rather than only at mount — otherwise the second
  // visit shows whichever tab the user last browsed to.
  useEffect(() => {
    if (isOpen) setActiveTab(initialWallet);
  }, [isOpen, initialWallet]);

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Add to Wallet"
      contentKey="add-to-wallet"
      contentClassName="md:max-w-2xl"
      containerClassName="min-h-[800px]"
      shouldAnimate={false}
    >
      <View className="p-6">
        {/* Tab buttons with underline indicator */}
        <View className="mb-8 flex-row">
          <Pressable
            className="relative flex-1 pb-4"
            onPress={() => setActiveTab(DigitalWalletType.Apple)}
          >
            <Text className="text-center text-base font-medium text-white">Apple Wallet</Text>
            {activeTab === DigitalWalletType.Apple && (
              <View className="absolute bottom-0 left-[20%] right-[20%] h-1 rounded-sm bg-[#94F27F]" />
            )}
          </Pressable>
          <Pressable
            className="relative flex-1 pb-4"
            onPress={() => setActiveTab(DigitalWalletType.Google)}
          >
            <Text className="text-center text-base font-medium text-white">Google Wallet</Text>
            {activeTab === DigitalWalletType.Google && (
              <View className="absolute bottom-0 left-[20%] right-[20%] h-1 rounded-sm bg-[#94F27F]" />
            )}
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === DigitalWalletType.Apple && (
          <View>
            <Text className="mb-8 text-2xl font-normal text-[#94F27F]">
              Add card to Apple Wallet
            </Text>

            <View className="mb-8">
              <Text className="mb-4 text-lg font-normal text-white">Copy your card info</Text>
              <View className="pl-2">
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • On your Card tab, tap &quot;Show&quot; on the card
                </Text>
                <Text className="text-base leading-6 text-gray-400">
                  • Copy your credit card details displayed: card number, expiration date and CVV
                </Text>
              </View>
            </View>

            <View className="mb-8">
              <Text className="mb-4 text-lg font-normal text-white">
                Add a card in Apple Wallet
              </Text>
              <View className="pl-2">
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • In the Apple Wallet app, tap the + button in the top-right corner
                </Text>
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • Select Debit or Credit Card
                </Text>
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • Paste your details when prompted
                </Text>
                <Text className="text-base leading-6 text-gray-400">
                  • Complete the rest of the Wallet app setup
                </Text>
              </View>
            </View>

            <Underline
              onPress={() => Linking.openURL('https://support.apple.com/en-gb/108398')}
              textClassName="text-base text-[#94F27F]"
              borderColor="rgba(148, 242, 127, 1)"
            >
              Read More
            </Underline>
          </View>
        )}

        {activeTab === DigitalWalletType.Google && (
          <View>
            <Text className="mb-8 text-2xl font-normal text-[#94F27F]">
              Add card to Google Wallet
            </Text>

            <View className="mb-8">
              <Text className="mb-4 text-lg font-normal text-white">Copy your card info</Text>
              <View className="pl-2">
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • On your Card tab, tap &quot;Show&quot; on the card
                </Text>
                <Text className="text-base leading-6 text-gray-400">
                  • Copy your credit card details displayed: card number, expiration date and CVV
                </Text>
              </View>
            </View>

            <View className="mb-8">
              <Text className="mb-4 text-lg font-normal text-white">
                Add a card in Google Wallet
              </Text>
              <View className="pl-2">
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • In the Google Wallet app, tap the + Add to Wallet button in the bottom-right
                  corner
                </Text>
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • Select Payment card
                </Text>
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • Choose New credit or debit card
                </Text>
                <Text className="mb-2 text-base leading-6 text-gray-400">
                  • Scan your card or choose &quot;Or enter details manually&quot; and paste your
                  details when prompted
                </Text>
                <Text className="text-base leading-6 text-gray-400">
                  • Complete the rest of the Wallet app setup
                </Text>
              </View>
            </View>

            <Underline
              onPress={() =>
                Linking.openURL('https://support.google.com/pay/india/answer/14253923?hl=en-GB')
              }
              textClassName="text-base text-[#94F27F]"
              borderColor="rgba(148, 242, 127, 1)"
            >
              Read More
            </Underline>
          </View>
        )}

        {/* OK Button */}
        <View className="mt-12">
          <Button variant="brand" onPress={() => onOpenChange(false)}>
            <Text className="text-base font-bold text-black">OK</Text>
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
}
