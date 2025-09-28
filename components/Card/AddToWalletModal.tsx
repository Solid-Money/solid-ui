import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

interface AddToWalletModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'add-to-wallet', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

export default function AddToWalletModal({ trigger, isOpen, onOpenChange }: AddToWalletModalProps) {
  const [activeTab, setActiveTab] = useState('apple');

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
        <View className="flex-row mb-8">
          <Pressable className="flex-1 pb-4 relative" onPress={() => setActiveTab('apple')}>
            <Text className="text-center text-white text-base font-medium">Apple Wallet</Text>
            {activeTab === 'apple' && (
              <View className="absolute bottom-0 left-[20%] right-[20%] h-1 bg-[#94F27F] rounded-sm" />
            )}
          </Pressable>
          <Pressable className="flex-1 pb-4 relative" onPress={() => setActiveTab('google')}>
            <Text className="text-center text-white text-base font-medium">Google Wallet</Text>
            {activeTab === 'google' && (
              <View className="absolute bottom-0 left-[20%] right-[20%] h-1 bg-[#94F27F] rounded-sm" />
            )}
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === 'apple' && (
          <View>
            <Text className="text-[#94F27F] text-2xl font-normal mb-8">
              Add card to Apple Wallet
            </Text>

            <View className="mb-8">
              <Text className="text-white text-lg font-normal mb-4">Copy your card info</Text>
              <View className="pl-2">
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • On your Card tab, tap &quot;Show&quot; on the card
                </Text>
                <Text className="text-gray-400 text-base leading-6">
                  • Copy your credit card details displayed: card number, expiration date and CVV
                </Text>
              </View>
            </View>

            <View className="mb-8">
              <Text className="text-white text-lg font-normal mb-4">
                Add a card in Apple Wallet
              </Text>
              <View className="pl-2">
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • In the Apple Wallet app, tap the + button in the top-right corner
                </Text>
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • Select Debit or Credit Card
                </Text>
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • Paste your details when prompted
                </Text>
                <Text className="text-gray-400 text-base leading-6">
                  • Complete the rest of the Wallet app setup
                </Text>
              </View>
            </View>

            <Pressable onPress={() => Linking.openURL('https://support.apple.com/en-gb/108398')}>
              <Text className="text-[#94F27F] text-base underline">Read More</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'google' && (
          <View>
            <Text className="text-[#94F27F] text-2xl font-normal mb-8">
              Add card to Google Wallet
            </Text>

            <View className="mb-8">
              <Text className="text-white text-lg font-normal mb-4">Copy your card info</Text>
              <View className="pl-2">
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • On your Card tab, tap &quot;Show&quot; on the card
                </Text>
                <Text className="text-gray-400 text-base leading-6">
                  • Copy your credit card details displayed: card number, expiration date and CVV
                </Text>
              </View>
            </View>

            <View className="mb-8">
              <Text className="text-white text-lg font-normal mb-4">
                Add a card in Google Wallet
              </Text>
              <View className="pl-2">
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • In the Google Wallet app, tap the + Add to Wallet button in the bottom-right
                  corner
                </Text>
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • Select Payment card
                </Text>
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • Choose New credit or debit card
                </Text>
                <Text className="text-gray-400 text-base leading-6 mb-2">
                  • Scan your card or choose &quot;Or enter details manually&quot; and paste your
                  details when prompted
                </Text>
                <Text className="text-gray-400 text-base leading-6">
                  • Complete the rest of the Wallet app setup
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                Linking.openURL('https://support.google.com/pay/india/answer/14253923?hl=en-GB')
              }
            >
              <Text className="text-[#94F27F] text-base underline">Read More</Text>
            </Pressable>
          </View>
        )}

        {/* OK Button */}
        <View className="mt-12">
          <Button onPress={() => onOpenChange(false)} className="bg-[#94F27F] py-6 rounded-xl">
            <Text className="text-black text-base font-bold">OK</Text>
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
}
