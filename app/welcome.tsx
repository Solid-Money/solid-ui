import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';
import { useShallow } from 'zustand/react/shallow';

import LoginKeyIcon from '@/assets/images/login_key_icon';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { eclipseUsername } from '@/lib/utils/utils';
import { useUserStore } from '@/store/useUserStore';

export default function Welcome() {
  const { handleRemoveUsers, handleSelectUserById } = useUser();
  const { users, _hasHydrated, pendingAuthUserId, selectUserById, unselectUser, setPendingAuthUserId } =
    useUserStore(
      useShallow(state => ({
        users: state.users,
        _hasHydrated: state._hasHydrated,
        pendingAuthUserId: state.pendingAuthUserId,
        selectUserById: state.selectUserById,
        unselectUser: state.unselectUser,
        setPendingAuthUserId: state.setPendingAuthUserId,
      })),
    );
  const { httpClient } = useTurnkey();
  const router = useRouter();
  const { isDesktop } = useDimension();
  const { session } = useLocalSearchParams<{ session: string }>();
  const passkeyUsers = users.filter(user => user.hasPasskey !== false);
  const selectedUserId = users.find(u => u.selected)?.userId;
  const isAuthInFlight = useRef(false);

  // Redirect to onboarding if no users exist (e.g., after session expired with empty user list)
  useEffect(() => {
    if (_hasHydrated && passkeyUsers.length === 0) {
      router.replace(path.ONBOARDING);
    }
  }, [_hasHydrated, passkeyUsers.length, router]);

  useEffect(() => {
    if (session === 'expired') {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Due to inactivity. Please login again.',
        props: {
          badgeText: '',
        },
      });
    }
  }, [session]);

  // After a user is clicked, the store's selected user changes which causes
  // TurnkeyProvider to re-mount with that user's credentialId in
  // `passkeyConfig.allowCredentials`. This effect waits for the new
  // httpClient to be ready and only then triggers the passkey prompt — so the
  // authenticator sees the filtered credential list and only the selected
  // user's passkey is offered.
  useEffect(() => {
    if (!pendingAuthUserId) return;
    if (!httpClient) return;
    if (selectedUserId !== pendingAuthUserId) return;
    if (isAuthInFlight.current) return;

    const userId = pendingAuthUserId;
    isAuthInFlight.current = true;

    handleSelectUserById(userId)
      .catch((error: any) => {
        // Revert the pre-selection so the welcome screen reflects the
        // un-authenticated state and TurnkeyProvider drops the filter.
        unselectUser();
        Toast.show({
          type: 'error',
          text1: 'Authentication failed',
          text2: error?.message || 'Please try again',
          props: {
            badgeText: '',
          },
        });
      })
      .finally(() => {
        // Keep `pendingAuthUserId` set while auth is in flight so every
        // button stays disabled, then clear it once we settle.
        setPendingAuthUserId(null);
        isAuthInFlight.current = false;
      });
  }, [
    pendingAuthUserId,
    httpClient,
    selectedUserId,
    handleSelectUserById,
    unselectUser,
    setPendingAuthUserId,
  ]);

  const handleSelectUser = useCallback(
    (userId: string) => {
      if (pendingAuthUserId || isAuthInFlight.current) return;

      // Marking the user as selected flips TurnkeyProvider's credentialId and
      // triggers a re-mount of TurnkeyProviderKit with
      // `allowCredentials: [{ id: user.credentialId, ... }]`. The effect above
      // picks up once the remount finishes and fires the passkey prompt.
      selectUserById(userId);
      setPendingAuthUserId(userId);
    },
    [pendingAuthUserId, selectUserById, setPendingAuthUserId],
  );

  const handleUseAnotherAccount = useCallback(() => {
    router.push(path.ONBOARDING);
  }, [router]);

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[440px] items-center">
      {/* Header */}
      <View className="mb-4 items-center">
        <Text className="text-center text-[34px] font-semibold leading-none text-white md:text-4xl">
          Welcome back
        </Text>
      </View>

      {/* Subtitle */}
      <Text className="native:text-lg mb-8 px-4 text-center text-base font-normal leading-tight text-white/60">
        Please select your account to continue, you will be asked to login with your passkey.
      </Text>

      {/* User List */}
      {!passkeyUsers.length ? null : (
        <View className="mb-4 w-full gap-3">
          {passkeyUsers.map(user => (
            <Button
              key={user.userId}
              variant="brand"
              className="h-14 justify-between rounded-xl border-0 px-6"
              onPress={() => handleSelectUser(user.userId)}
              disabled={pendingAuthUserId !== null}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold">
                  {eclipseUsername(user.username || user.email || '', 20)}
                </Text>
              </View>
              <View className="opacity-60">
                <LoginKeyIcon color="#000" />
              </View>
            </Button>
          ))}
        </View>
      )}

      {/* Use another account button */}
      <Button
        variant="secondary"
        onPress={handleUseAnotherAccount}
        className="mb-6 h-14 w-full rounded-xl border-0"
      >
        <Text className="text-base font-semibold text-white">Use another account</Text>
      </Button>

      {/* Forget all users */}
      {users.length > 0 && (
        <Button variant="ghost" className="h-14 rounded-xl" onPress={handleRemoveUsers}>
          <Text className="text-base font-bold text-muted-foreground">Forget all users</Text>
        </Button>
      )}

      {/* Recover account */}
      {/* <Button
        variant="ghost"
        className="h-14 rounded-xl"
        onPress={() => router.push(path.RECOVERY)}
      >
        <Text className="text-base font-bold text-muted-foreground">Recover account</Text>
      </Button> */}
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background text-foreground">
        <View className="flex-1 px-6">
          {/* Logo at top */}
          <View className="items-center pb-16 pt-8">
            <Image
              source={getAsset('images/solid-logo-4x.png')}
              alt="Solid logo"
              style={{ width: 40, height: 44 }}
              contentFit="contain"
            />
          </View>

          {/* Content centered */}
          <View className="flex-1 justify-center pb-8">{formContent}</View>
        </View>
      </SafeAreaView>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel />
      {/* TODO: lazy-loaded for FCP improvement */}
      {/* <LazyDesktopCarousel /> */}

      {/* Right Section - Form (70%) */}
      <View className="relative flex-1">
        {/* Logo at top center */}
        <View className="absolute left-0 right-0 top-6 items-center">
          <Image
            source={getAsset('images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Form Content */}
        <View className="flex-1 items-center justify-center px-8">{formContent}</View>
      </View>
    </View>
  );
}
