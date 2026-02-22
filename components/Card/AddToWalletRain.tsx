import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useQuery } from '@tanstack/react-query';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DigitalWalletType } from '@/constants/digital-wallet';
import { useCardDetails } from '@/hooks/useCardDetails';
import { getMppCredentials, getWalletEligibility } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

import type { CardDetailsResponseDto } from '@/lib/types';

let MeaPushProvisioning: typeof import('@meawallet/react-native-mpp').default | null = null;
let MppCardDataParameters:
  | typeof import('@meawallet/react-native-mpp').MppCardDataParameters
  | null = null;
try {
  const mpp = require('@meawallet/react-native-mpp');
  MeaPushProvisioning = mpp.default;
  MppCardDataParameters = mpp.MppCardDataParameters;
} catch {
  // Module not linked (web or dev without native build)
}

function cardholderName(details: CardDetailsResponseDto | undefined): string {
  if (!details?.cardholder_name) return '';
  const { first_name, last_name } = details.cardholder_name;
  return [first_name, last_name].filter(Boolean).join(' ');
}

interface AddToWalletRainProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'add-to-wallet-rain', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

const WALLET_ELIGIBILITY_KEY = 'walletEligibility';

export default function AddToWalletRain({ trigger, isOpen, onOpenChange }: AddToWalletRainProps) {
  const [activeTab, setActiveTab] = useState<DigitalWalletType>(DigitalWalletType.Apple);
  const [isAddingApple, setIsAddingApple] = useState(false);
  const [isAddingGoogle, setIsAddingGoogle] = useState(false);

  const { data: cardDetails } = useCardDetails();
  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: [WALLET_ELIGIBILITY_KEY],
    queryFn: () => withRefreshToken(() => getWalletEligibility()),
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  const eligible = eligibility?.eligible ?? false;
  const alreadyApple = eligibility?.alreadyInAppleWallet ?? false;
  const alreadyGoogle = eligibility?.alreadyInGoogleWallet ?? false;

  const appleMppAvailable = useMemo(
    () =>
      Platform.OS === 'ios' &&
      MeaPushProvisioning != null &&
      !(MeaPushProvisioning as { __stub?: boolean }).__stub &&
      MppCardDataParameters != null,
    [],
  );
  const googleMppAvailable = useMemo(
    () =>
      Platform.OS === 'android' &&
      MeaPushProvisioning != null &&
      !(MeaPushProvisioning as { __stub?: boolean }).__stub &&
      MppCardDataParameters != null,
    [],
  );

  const handleAddToAppleWallet = async () => {
    if (!appleMppAvailable) {
      Toast.show({
        type: 'info',
        text1: 'Available in the app',
        text2: 'Add to Apple Wallet is available in the iOS app.',
      });
      return;
    }
    if (!eligible || alreadyApple) return;
    if (!cardDetails?.id) return;
    setIsAddingApple(true);
    try {
      const creds = await withRefreshToken(() => getMppCredentials());
      if (!creds) return;
      const cardParams = MppCardDataParameters!.withCardSecret(creds.cardId, creds.cardSecret);
      const isPassLibraryAvailable = await MeaPushProvisioning!.ApplePay.isPassLibraryAvailable();
      if (!isPassLibraryAvailable) {
        Toast.show({
          type: 'info',
          text1: 'Apple Wallet',
          text2: 'Pass library is not available.',
        });
        return;
      }
      const canAdd = await MeaPushProvisioning!.ApplePay.canAddPaymentPass();
      if (!canAdd) {
        Toast.show({
          type: 'info',
          text1: 'Apple Wallet',
          text2: 'Cannot add payment pass on this device.',
        });
        return;
      }
      const tokenizationData =
        await MeaPushProvisioning!.ApplePay.initializeOemTokenization(cardParams);
      await MeaPushProvisioning!.ApplePay.showAddPaymentPassView(tokenizationData);
      Toast.show({
        type: 'success',
        text1: 'Added to Apple Wallet',
        text2: 'Your card is now in Apple Wallet.',
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add to Apple Wallet';
      if (!message.includes('native module') && !message.includes('not linked')) {
        Toast.show({ type: 'error', text1: 'Could not add to Apple Wallet', text2: message });
      }
    } finally {
      setIsAddingApple(false);
    }
  };

  const handleAddToGoogleWallet = async () => {
    if (!googleMppAvailable) {
      Toast.show({
        type: 'info',
        text1: 'Available in the app',
        text2: 'Add to Google Wallet is available in the Android app.',
      });
      return;
    }
    if (!eligible || alreadyGoogle) return;
    if (!cardDetails?.id) return;
    setIsAddingGoogle(true);
    try {
      const creds = await withRefreshToken(() => getMppCredentials());
      if (!creds) return;
      const cardParams = MppCardDataParameters!.withCardSecret(creds.cardId, creds.cardSecret);
      const name = cardholderName(cardDetails) || 'Cardholder';
      await MeaPushProvisioning!.GooglePay.pushCard(cardParams, name, '');
      Toast.show({
        type: 'success',
        text1: 'Added to Google Wallet',
        text2: 'Your card is now in Google Wallet.',
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add to Google Wallet';
      if (!message.includes('native module') && !message.includes('not linked')) {
        Toast.show({ type: 'error', text1: 'Could not add to Google Wallet', text2: message });
      }
    } finally {
      setIsAddingGoogle(false);
    }
  };

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Add to Wallet"
      contentKey="add-to-wallet-rain"
      contentClassName="md:max-w-2xl"
      containerClassName="min-h-[400px]"
      shouldAnimate={false}
    >
      <View className="p-6">
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

        {eligibilityLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#94F27F" />
            <Text className="mt-4 text-muted-foreground">Checking eligibility...</Text>
          </View>
        ) : !eligible && eligibility != null ? (
          <View className="py-4">
            <Text className="text-center text-muted-foreground">
              {eligibility.reason ?? 'Your card is not eligible for add to wallet right now.'}
            </Text>
          </View>
        ) : activeTab === DigitalWalletType.Apple ? (
          <View>
            <Text className="mb-6 text-2xl font-normal text-[#94F27F]">
              Add card to Apple Wallet
            </Text>
            {alreadyApple ? (
              <Text className="text-muted-foreground">This card is already in Apple Wallet.</Text>
            ) : (
              <Button
                onPress={handleAddToAppleWallet}
                disabled={isAddingApple}
                className="rounded-xl bg-[#94F27F] py-6"
              >
                {isAddingApple ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text className="text-base font-bold text-black">Add to Apple Wallet</Text>
                )}
              </Button>
            )}
          </View>
        ) : (
          <View>
            <Text className="mb-6 text-2xl font-normal text-[#94F27F]">
              Add card to Google Wallet
            </Text>
            {alreadyGoogle ? (
              <Text className="text-muted-foreground">This card is already in Google Wallet.</Text>
            ) : (
              <Button
                onPress={handleAddToGoogleWallet}
                disabled={isAddingGoogle}
                className="rounded-xl bg-[#94F27F] py-6"
              >
                {isAddingGoogle ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text className="text-base font-bold text-black">Add to Google Wallet</Text>
                )}
              </Button>
            )}
          </View>
        )}

        <View className="mt-12">
          <Button onPress={() => onOpenChange(false)} className="rounded-xl bg-[#94F27F] py-6">
            <Text className="text-base font-bold text-black">OK</Text>
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
}
