import InfoError from '@/assets/images/info-error';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { updateExternalWalletAddress } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';
import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAddress } from 'viem';

export default function QuestWallet() {
  const router = useRouter();
  const { user } = useUser();
  const { updateUser } = useUserStore();
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [initialAddressExists] = useState(() => !!user?.externalWalletAddress);

  // Prefill with existing address if available (only on mount)
  useEffect(() => {
    if (user?.externalWalletAddress) {
      setWalletAddress(user.externalWalletAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    // Validate Ethereum address
    if (!isAddress(walletAddress)) {
      setError('Invalid Ethereum address');
      setLoading(false);
      track(TRACKING_EVENTS.QUEST_WALLET_VALIDATION_ERROR, {
        error: 'Invalid Ethereum address',
        address: walletAddress,
      });
      return;
    }

    track(TRACKING_EVENTS.QUEST_WALLET_ADDRESS_SUBMITTED, {
      addressLength: walletAddress.length,
      isUpdate: initialAddressExists,
    });

    try {
      await updateExternalWalletAddress(walletAddress);

      // Update the user store with the new address
      if (user) {
        updateUser({
          ...user,
          externalWalletAddress: walletAddress,
        });
      }

      setSuccess(true);
      track(TRACKING_EVENTS.QUEST_WALLET_UPDATE_SUCCESS, {
        address: walletAddress,
        isUpdate: initialAddressExists,
      });
    } catch (err) {
      console.error(err);
      Sentry.captureException(err);
      setError('Failed to update wallet address. Please try again.');
      track(TRACKING_EVENTS.QUEST_WALLET_UPDATE_FAILED, {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background text-foreground">
      <View className="mx-auto w-full max-w-lg px-4 pt-12">
        <Text className="mb-8 text-center text-xl font-semibold text-white md:text-2xl">
          Quest Wallet Address
        </Text>
        {!success ? (
          <WalletAddressInput
            walletAddress={walletAddress}
            onChangeWalletAddress={setWalletAddress}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            isUpdate={initialAddressExists}
          />
        ) : (
          <Success onClose={() => router.push(path.HOME)} isUpdate={initialAddressExists} />
        )}
      </View>
    </SafeAreaView>
  );
}

interface WalletAddressInputProps {
  walletAddress: string;
  onChangeWalletAddress: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  isUpdate: boolean;
}

function WalletAddressInput({
  walletAddress,
  onChangeWalletAddress,
  onSubmit,
  loading,
  error,
  isUpdate,
}: WalletAddressInputProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">
          External Wallet Address
        </Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          {isUpdate
            ? 'Update your external wallet address (EOA) for completing quests on our partner platform'
            : "Enter your external wallet address (EOA) that you'll use to complete quests on our partner platform"}
        </Text>

        <TextInput
          className="mb-4 h-12 rounded-xl bg-[#1A1A1A] px-4 text-white"
          placeholder="0x..."
          placeholderTextColor="#666"
          value={walletAddress}
          onChangeText={onChangeWalletAddress}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {error && (
          <View className="mb-4 flex-row items-center gap-2">
            <InfoError />
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}
        <Button
          className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
          onPress={onSubmit}
          disabled={!walletAddress || loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">
              {isUpdate ? 'Update Address' : 'Save Address'}
            </Text>
          )}
        </Button>
      </View>
    </View>
  );
}

interface SuccessProps {
  onClose: () => void;
  isUpdate: boolean;
}

function Success({ onClose, isUpdate }: SuccessProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Success</Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          {isUpdate
            ? 'Your external wallet address has been updated successfully.'
            : 'Your external wallet address has been saved successfully. You can now use it to complete quests on our partner platform.'}
        </Text>

        <Button className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]" onPress={onClose}>
          <Text className="text-base font-bold text-black">Done</Text>
        </Button>
      </View>
    </View>
  );
}
