import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
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
import { v4 as uuidv4 } from 'uuid';
import { mainnet } from 'viem/chains';

import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track, trackIdentity } from '@/lib/analytics';
import { emailSignUp } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { User } from '@/lib/types';
import { useSignupFlowStore } from '@/store/useSignupFlowStore';
import { useUserStore } from '@/store/useUserStore';
// React Native Turnkey SDK for native session management
import { useTurnkey } from '@turnkey/sdk-react-native';

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
  }, []);

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
  const { storeUser } = useUserStore();
  const {
    email,
    verificationToken,
    challenge,
    attestation,
    credentialId,
    marketingConsent,
    referralCode,
    setStep,
    setError,
  } = useSignupFlowStore();
  // Native Turnkey SDK for session management (only used on native)
  const turnkeyContext = Platform.OS !== 'web' ? useTurnkey() : null;

  useEffect(() => {
    // Redirect if missing required data
    if (!verificationToken || !email || !challenge || !attestation) {
      router.replace(path.SIGNUP_PASSKEY);
      return;
    }

    createAccount();
  }, []);

  const createAccount = async () => {
    track(TRACKING_EVENTS.SIGNUP_STARTED, {
      email,
    });

    try {
      // Generate session key pair for Turnkey (used for OTP login validation + native sessions)
      let sessionPublicKey: string;
      let indexedDbClient: any = null;

      if (Platform.OS === 'web') {
        const { Turnkey } = await import('@turnkey/sdk-browser');
        const turnkey = new Turnkey({
          apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
          defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
          rpId: getRuntimeRpId(),
        });

        indexedDbClient = await turnkey.indexedDbClient();
        await indexedDbClient?.init();
        await indexedDbClient!.resetKeyPair();
        const key = await indexedDbClient!.getPublicKey();
        sessionPublicKey = key || uuidv4();
      } else {
        // For React Native, generate a proper embedded key for Turnkey session
        if (!turnkeyContext) {
          throw new Error('Turnkey context not available on native');
        }
        sessionPublicKey = await turnkeyContext.createEmbeddedKey();
      }

      // Create account via backend (creates sub-org with passkey + wallet)
      const user = await emailSignUp(
        email,
        verificationToken,
        sessionPublicKey,
        challenge,
        attestation,
        credentialId,
        referralCode || undefined,
        marketingConsent,
      );

      // On native, create Turnkey session using credential bundle
      if (Platform.OS !== 'web' && turnkeyContext && user.credentialBundle) {
        await turnkeyContext.createSession({
          bundle: user.credentialBundle,
        });
      }

      // Create Safe smart account (requires Turnkey session for signing)
      // On native, pass the session-based client; on web, the indexedDb session is used automatically
      const clientToPass = Platform.OS !== 'web' ? turnkeyContext?.client : undefined;

      const smartAccountClient = await safeAA(
        mainnet,
        user.subOrganizationId,
        user.walletAddress,
        clientToPass,
      );

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

      // Track identity
      trackIdentity(user._id, {
        username: user.username,
        email: user.email,
        safe_address: safeAddress,
        has_referral_code: !!user.referralCode,
        signup_method: 'email_passkey',
        platform: Platform.OS,
      });

      track(TRACKING_EVENTS.SIGNUP_COMPLETED, {
        user_id: user._id,
        username: user.username,
        email: user.email,
        referral_code: referralCode,
        safe_address: safeAddress,
        has_passkey: true,
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

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1 justify-center items-center px-4">
        {/* Header section */}
        <View className="items-center mb-10">
          <Text className="text-white/60 text-[16px] mb-2">Please wait</Text>
          <Text className="text-white text-[38px] md:text-4xl font-semibold text-center">
            Creating your wallet
          </Text>
        </View>

        {/* Animated wallet icon */}
        <WalletLoadingIcon />
      </View>
    </SafeAreaView>
  );
}
