import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { mainnet } from 'viem/chains';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track, trackIdentity } from '@/lib/analytics';
import { emailSignUp } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { User } from '@/lib/types';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';
import { useUserStore } from '@/store/useUserStore';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Wallet outline path
const WALLET_OUTLINE_PATH =
  'M127.72 1H32.68C15.184 1 1 15.112 1 32.52v78.8c0 17.408 14.184 31.52 31.68 31.52h95.04c17.496 0 31.68-14.112 31.68-31.52v-78.8C159.4 15.112 145.216 1 127.72 1';

// Inner clasp path
const WALLET_CLASP_PATH =
  'M1 48.674h26.69a23.82 23.82 0 0 1 16.801 6.924 23.58 23.58 0 0 1 6.96 16.717 23.58 23.58 0 0 1-6.96 16.715 23.82 23.82 0 0 1-16.8 6.925H1';

// Approximate perimeter of the wallet outline path
const PATH_LENGTH = 520;

// Animated loading wallet icon component
function WalletLoadingIcon() {
  const dashOffset = useSharedValue(0);

  useEffect(() => {
    // Animate dashOffset from 0 to PATH_LENGTH infinitely
    dashOffset.value = withRepeat(
      withTiming(PATH_LENGTH, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1, // -1 means infinite repeat
      false, // don't reverse
    );
  }, [dashOffset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <View className="items-center justify-center">
      <Svg width={161} height={144} viewBox="0 0 161 144">
        {/* Static wallet outline (dimmed) */}
        <Path
          d={WALLET_OUTLINE_PATH}
          stroke="#fff"
          strokeOpacity={0.2}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Animated spinning arc on the wallet outline */}
        <AnimatedPath
          d={WALLET_OUTLINE_PATH}
          stroke="#fff"
          strokeOpacity={0.8}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`100 ${PATH_LENGTH - 100}`}
          animatedProps={animatedProps}
        />

        {/* Inner clasp (static) */}
        <Path
          d={WALLET_CLASP_PATH}
          stroke="#fff"
          strokeOpacity={0.7}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export default function SignupCreating() {
  const router = useRouter();
  const { safeAA } = useUser();
  const { users, storeUser, _hasHydrated: userStoreHydrated } = useUserStore();
  const {
    email,
    verificationToken,
    challenge,
    attestation,
    credentialId,
    marketingConsent,
    referralCode,
    _hasHydrated,
    setStep,
    setError,
  } = useSignupFlowStore();
  const _attributionHydrated = useAttributionStore(state => state._hasHydrated);
  // Guard against duplicate execution (React Strict Mode double-invokes effects in dev)
  const isCreatingRef = useRef(false);

  useEffect(() => {
    // Wait for all stores to hydrate before making decisions
    // This ensures attribution data is loaded from MMKV before signup
    if (!_hasHydrated || !userStoreHydrated || !_attributionHydrated) return;

    // If user already exists (signup previously succeeded), redirect to home
    // This prevents duplicate createAccount() calls if user navigates back
    if (users.length > 0) {
      if (Platform.OS === 'web') {
        router.replace(path.HOME);
      } else {
        router.replace(path.NOTIFICATIONS);
      }
      return;
    }

    // Redirect if missing required data
    if (!verificationToken || !email || !challenge || !attestation) {
      router.replace(path.SIGNUP_PASSKEY);
      return;
    }

    // Prevent duplicate API calls
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;

    createAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, userStoreHydrated, _attributionHydrated]);

  const createAccount = async () => {
    // Capture attribution context for signup tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    track(TRACKING_EVENTS.SIGNUP_STARTED, {
      email,
      ...attributionData,
      attribution_channel: attributionChannel,
    });

    try {
      // Create account via backend (creates sub-org with passkey + wallet)
      const user = await emailSignUp(
        email,
        verificationToken,
        challenge,
        attestation,
        credentialId,
        referralCode || undefined,
        marketingConsent,
      );

      const smartAccountClient = await safeAA(mainnet, user.subOrganizationId, user.walletAddress);

      if (!smartAccountClient?.account?.address) {
        throw new Error('Failed to create smart account');
      }

      const safeAddress = smartAccountClient.account.address;

      // Store user in local state
      const selectedUser: User = {
        safeAddress,
        username: user.username,
        userId: user._id,
        signWith: user.walletAddress,
        suborgId: user.subOrganizationId,
        selected: true,
        tokens: user.tokens || null,
        email: user.email,
        referralCode: user.referralCode,
        turnkeyUserId: user.turnkeyUserId,
        credentialId: credentialId,
      };
      storeUser(selectedUser);

      // Track identity with attribution for user profile enrichment
      trackIdentity(user._id, {
        username: user.username,
        email: user.email,
        safe_address: safeAddress,
        has_referral_code: !!user.referralCode,
        signup_method: 'email_passkey',
        platform: Platform.OS,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      track(TRACKING_EVENTS.SIGNUP_COMPLETED, {
        user_id: user._id,
        username: user.username,
        email: user.email,
        referral_code: referralCode,
        safe_address: safeAddress,
        has_passkey: true,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      // Navigate to home/notifications
      setStep('complete');

      if (Platform.OS === 'web') {
        router.replace(path.HOME);
      } else {
        router.replace(path.NOTIFICATIONS);
      }
    } catch (err: any) {
      console.error('Failed to create account:', err);

      let errorMessage = err?.message || 'Failed to create account. Please try again.';

      setError(errorMessage);

      track(TRACKING_EVENTS.SIGNUP_FAILED, {
        email,
        error: errorMessage,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      if (Platform.OS === 'web') {
        Toast.show({
          type: 'error',
          text1: 'Account Setup Failed',
          text2: errorMessage,
        });
      }

      Sentry.captureException(err, {
        tags: { type: 'signup_account_creation_error' },
        extra: { email },
      });

      // Go back to passkey step on error
      setStep('passkey');
      router.replace(path.SIGNUP_PASSKEY);
    }
  };

  // Wait for stores to hydrate before rendering
  if (!_hasHydrated || !userStoreHydrated) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background text-foreground">
      <View className="flex-1 items-center justify-center px-4">
        {/* Header section */}
        <View className="mb-10 items-center">
          <Text className="mb-2 text-[16px] text-white/60">Please wait</Text>
          <Text className="text-center text-[38px] font-semibold -tracking-[1px] text-white md:text-4xl">
            Creating your wallet
          </Text>
        </View>

        {/* Animated wallet icon */}
        <WalletLoadingIcon />
      </View>
    </SafeAreaView>
  );
}
