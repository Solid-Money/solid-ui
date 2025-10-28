import InfoError from '@/assets/images/info-error';
import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { startPasskeyRecovery } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { Turnkey, TurnkeyIframeClient } from '@turnkey/sdk-browser';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecoveryPasskey() {
  const turnkey = new Turnkey({
    apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
    defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
    rpId: getRuntimeRpId(),
  });
  const steps = {
    USERNAME_INPUT: 'username-input',
    BUNDLE_SUBMIT: 'bundle-submit',
    ADD_PASSKEY: 'add-passkey',
    SUCCESS: 'success',
  };
  const [step, setStep] = useState(steps.USERNAME_INPUT);
  const [error, setError] = useState('');

  const router = useRouter();
  const iframeContainerId = 'turnkey-auth-iframe-container-id';
  const iframeContainer = document.getElementById(iframeContainerId);
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  const [username, setUsername] = useState('');
  const [bundle, setBundle] = useState('');
  const [userId, setUserId] = useState('');
  const [subOrganizationId, setSubOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitUsername = async () => {
    setLoading(true);
    setError('');
    const iframeClient = await turnkey.iframeClient({
      iframeContainer: iframeContainer as HTMLElement,
      iframeUrl: 'https://auth.turnkey.com',
    });
    setIframeClient(iframeClient);
    try {
      const recoveryResponse = await startPasskeyRecovery(
        username,
        iframeClient.iframePublicKey ?? '',
      );
      if (recoveryResponse.success) {
        setUserId(recoveryResponse.userId);
        setSubOrganizationId(recoveryResponse.subOrganizationId);
        setStep(steps.BUNDLE_SUBMIT);
      }
    } catch {
      setError('Invalid username or not found');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBundle = async () => {
    setLoading(true);
    setError('');
    try {
      const authenticationResponse = await iframeClient?.injectCredentialBundle(bundle);
      if (authenticationResponse) {
        setStep(steps.ADD_PASSKEY);
      }
    } catch {
      setError('Invalid code');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAddPasskey = async () => {
    setLoading(true);
    setError('');
    try {
      const passkeyClient = turnkey.passkeyClient();
      const passkey = await passkeyClient.createUserPasskey({
        publicKey: {
          user: {
            name: username,
            displayName: username,
          },
        },
      });
      if (passkey) {
        const authenticatorsResponse = await iframeClient?.createAuthenticators({
          authenticators: [
            {
              authenticatorName: 'New Passkey Authenticator',
              challenge: passkey.encodedChallenge,
              attestation: passkey.attestation,
            },
          ],
          userId: userId,
          organizationId: subOrganizationId,
        });
        if (authenticatorsResponse?.activity.id) {
          setStep(steps.SUCCESS);
        }
      }
    } catch {
      setError('Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View id={iframeContainerId} className="hidden" />
      {/* Email modal */}
      <View className="w-full max-w-lg mx-auto pt-12 px-4">
        <View className="flex-row items-center justify-between mb-10">
          <Pressable onPress={goBack} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Passkey Recovery
          </Text>
          <View className="w-10" />
        </View>
        {step === steps.USERNAME_INPUT && (
          <UsernameSelector
            username={username}
            onChangeUsername={setUsername}
            onSubmit={handleSubmitUsername}
            loading={loading}
            error={error}
          />
        )}
        {step === steps.BUNDLE_SUBMIT && (
          <BundleSubmit
            bundle={bundle}
            onChangeBundle={setBundle}
            onSubmit={handleSubmitBundle}
            loading={loading}
            error={error}
          />
        )}
        {step === steps.ADD_PASSKEY && (
          <AddPasskey onSubmit={handleSubmitAddPasskey} loading={loading} error={error} />
        )}
        {step === steps.SUCCESS && <Success />}
      </View>
    </SafeAreaView>
  );
}

// Email Selector Component
interface UsernameSelectorProps {
  username: string;
  onChangeUsername: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}

function UsernameSelector({
  username,
  onChangeUsername,
  onSubmit,
  loading,
  error,
}: UsernameSelectorProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">Username</Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Please enter your username to recover your passkey
        </Text>

        <TextInput
          className="bg-[#1A1A1A] rounded-xl px-4 h-12 text-white mb-4"
          placeholder="Enter your username"
          placeholderTextColor="#666"
          value={username}
          onChangeText={onChangeUsername}
          autoFocus
        />
        {error && (
          <View className="flex-row items-center gap-2 mb-4">
            <InfoError />
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}
        <Button
          className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
          onPress={onSubmit}
          disabled={!username || loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Next</Text>
          )}
        </Button>
      </View>
    </View>
  );
}

interface BundleSubmitProps {
  bundle: string;
  onChangeBundle: (text: string) => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
  error: string;
}

function BundleSubmit({ bundle, onChangeBundle, onSubmit, loading, error }: BundleSubmitProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">Unique Code</Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Please enter your unique code sent to your email
        </Text>

        <TextInput
          className="bg-[#1A1A1A] rounded-xl px-4 h-12 text-white mb-4"
          placeholder="Code"
          placeholderTextColor="#666"
          value={bundle}
          onChangeText={onChangeBundle}
          autoFocus
        />
        {error && (
          <View className="flex-row items-center gap-2 mb-4">
            <InfoError />
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}
        <Button
          className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
          onPress={onSubmit}
          disabled={!bundle || loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Submit</Text>
          )}
        </Button>
      </View>
    </View>
  );
}

interface AddPasskeyProps {
  onSubmit: () => Promise<void>;
  loading: boolean;
  error: string;
}

function AddPasskey({ onSubmit, loading, error }: AddPasskeyProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">Add Passkey</Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Create a new passkey to access your account
        </Text>

        <Button
          className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-base font-bold text-black">Create Passkey</Text>
          )}
        </Button>
        {error && (
          <View className="flex-row items-center gap-2 mb-4">
            <InfoError />
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Success() {
  const router = useRouter();
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">Success</Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Your passkey has been created successfully
        </Text>

        <Button
          className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
          onPress={() => router.push(path.HOME)}
        >
          <Text className="text-base font-bold text-black">Home</Text>
        </Button>
      </View>
    </View>
  );
}
