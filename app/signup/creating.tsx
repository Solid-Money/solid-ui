import { useEffect, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { mainnet } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track, trackIdentity } from '@/lib/analytics';
import { emailSignUp, initSignupOtp } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { isSharedReviewAccessEmail } from '@/lib/reviewerAccess';
import { User } from '@/lib/types';
import {
  AccountCreationRecovery,
  getAccountCreationRecovery,
  getAccountCreationStatus,
  isRateLimitedError,
} from '@/lib/utils/signupAccountCreation';
import { redactSecrets, userFacingErrorMessage } from '@/lib/utils/userFacingError';
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

type CreatedAccount = Awaited<ReturnType<typeof emailSignUp>>;

/** A failure the person can act on from this screen. */
type CreationFailure = {
  recovery: Exclude<AccountCreationRecovery, 'choose_username' | 'new_passkey'>;
  message: string;
  /** Which attempt on this screen failed. */
  attempt: number;
  /** The server created the account; only the wallet setup after it failed. */
  accountCreated: boolean;
};

/**
 * Retries that fail this many times in a row also offer a new passkey: if the
 * server keeps refusing this one, retrying it cannot succeed.
 */
const NEW_PASSKEY_AFTER_ATTEMPTS = 2;

const FAILURE_TITLES: Record<CreationFailure['recovery'], string> = {
  retry: "We couldn't finish creating your account",
  verify_email: 'Verify your email again',
  log_in: 'You already have an account',
};

const FAILURE_ACTIONS: Record<CreationFailure['recovery'], string> = {
  retry: 'Try again',
  verify_email: 'Verify email',
  log_in: 'Log in',
};

export default function SignupCreating() {
  const router = useRouter();
  const { safeAA } = useUser();
  const {
    hasSelectedUser,
    storeUser,
    _hasHydrated: userStoreHydrated,
  } = useUserStore(
    useShallow(state => ({
      hasSelectedUser: state.users.some(user => user.selected),
      storeUser: state.storeUser,
      _hasHydrated: state._hasHydrated,
    })),
  );

  const {
    email,
    username,
    verificationToken,
    challenge,
    attestation,
    credentialId,
    marketingConsent,
    referralCode,
    _hasHydrated,
    setStep,
    setError,
    setOtpId,
    setLastOtpSentAt,
  } = useSignupFlowStore(
    useShallow(state => ({
      email: state.email,
      username: state.username,
      verificationToken: state.verificationToken,
      challenge: state.challenge,
      attestation: state.attestation,
      credentialId: state.credentialId,
      marketingConsent: state.marketingConsent,
      referralCode: state.referralCode,
      _hasHydrated: state._hasHydrated,
      setStep: state.setStep,
      setError: state.setError,
      setOtpId: state.setOtpId,
      setLastOtpSentAt: state.setLastOtpSentAt,
    })),
  );
  const _attributionHydrated = useAttributionStore(state => state._hasHydrated);
  const isSharedReviewAccess = isSharedReviewAccessEmail(email);
  // Guard against duplicate execution (React Strict Mode double-invokes effects in dev)
  const isCreatingRef = useRef(false);
  // A retry must not overlap an attempt still in flight.
  const isAttemptInFlightRef = useRef(false);
  const attemptRef = useRef(0);
  // The account, once the server has created it. The steps after it (the Safe
  // address, from our RPC) can still fail, and a retry has to resume there:
  // asking the server again is refused with "Email already registered".
  const createdAccountRef = useRef<CreatedAccount | null>(null);
  const [failure, setFailure] = useState<CreationFailure | null>(null);

  useEffect(() => {
    // Wait for all stores to hydrate before making decisions
    // This ensures attribution data is loaded from MMKV before signup
    if (!_hasHydrated || !userStoreHydrated || !_attributionHydrated) return;

    // If a selected user already exists, signup previously succeeded.
    // Redirect to avoid duplicate createAccount() calls on revisit.
    if (hasSelectedUser) {
      const { redirectFrom, setRedirectFrom } = useUserStore.getState();
      if (redirectFrom) {
        setRedirectFrom(null);
        router.replace(redirectFrom as any);
      } else {
        // Signup already completed on a previous render/session. Returning to
        // this screen must not replay notification onboarding.
        router.replace(path.HOME);
      }
      return;
    }

    // Redirect if missing required data
    if (!verificationToken || !email) {
      router.replace(path.SIGNUP_EMAIL);
      return;
    }

    // Reached without choosing a handle — the step was skipped, or the flow
    // was resumed from a build that predates it. Ask rather than fall back to
    // a name derived from the email address.
    if (!isSharedReviewAccess && !username) {
      router.replace(path.SIGNUP_USERNAME);
      return;
    }

    if (!isSharedReviewAccess && (!challenge || !attestation)) {
      router.replace(path.SIGNUP_PASSKEY);
      return;
    }

    // Prevent duplicate API calls
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;

    createAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, userStoreHydrated, _attributionHydrated, hasSelectedUser, router]);

  const createAccount = async () => {
    if (isAttemptInFlightRef.current) return;
    isAttemptInFlightRef.current = true;
    attemptRef.current += 1;
    setFailure(null);

    // Capture attribution context for signup tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    track(TRACKING_EVENTS.SIGNUP_STARTED, {
      email,
      ...attributionData,
      attribution_channel: attributionChannel,
      attempt: attemptRef.current,
    });

    try {
      // Create account via backend (creates sub-org with passkey + wallet).
      // Retries reuse the passkey made on the previous step: a new one would
      // be left on the device beside it, offered at every login, opening nothing.
      let user = createdAccountRef.current;
      if (!user) {
        user = await emailSignUp(
          email,
          verificationToken,
          challenge,
          attestation,
          credentialId,
          referralCode || undefined,
          marketingConsent,
          username || undefined,
        );
        createdAccountRef.current = user;
      }

      let safeAddress = user.safeAddress;
      if (!safeAddress) {
        const smartAccountClient = await safeAA(
          mainnet,
          user.subOrganizationId,
          user.walletAddress,
        );

        if (!smartAccountClient?.account?.address) {
          throw new Error('Failed to create smart account');
        }

        safeAddress = smartAccountClient.account.address;
      }

      // Store user in local state
      const selectedUser: User = {
        safeAddress,
        walletAddress: user.walletAddress,
        username: user.username,
        userId: user._id,
        signWith: user.walletAddress,
        suborgId: user.subOrganizationId,
        selected: true,
        tokens: user.tokens || null,
        email: user.email,
        referralCode: user.referralCode,
        turnkeyUserId: user.turnkeyUserId,
        credentialId: user.credentialId ?? credentialId,
        hasPasskey: user.hasPasskey ?? !isSharedReviewAccess,
      };
      storeUser(selectedUser);

      // Track identity with attribution for user profile enrichment
      trackIdentity(user._id, {
        username: user.username,
        email: user.email,
        safe_address: safeAddress,
        has_referral_code: !!user.referralCode,
        signup_method: isSharedReviewAccess ? 'shared_email_otp' : 'email_passkey',
        platform: Platform.OS,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      // Amplitude is emitted server-side as "Account Created" (backend signup
      // flow); suppress the client Amplitude event to avoid double-counting.
      // Firebase + GTM still fire here to preserve web conversion attribution.
      track(
        TRACKING_EVENTS.SIGNUP_COMPLETED,
        {
          user_id: user._id,
          username: user.username,
          email: user.email,
          referral_code: referralCode,
          safe_address: safeAddress,
          has_passkey: selectedUser.hasPasskey,
          ...attributionData,
          attribution_channel: attributionChannel,
        },
        { amplitude: false },
      );

      // Navigate to home/notifications or redirectFrom page
      setStep('complete');

      const { redirectFrom, setRedirectFrom } = useUserStore.getState();
      if (redirectFrom) {
        setRedirectFrom(null);
        router.replace(redirectFrom as any);
      } else if (Platform.OS === 'web') {
        router.replace(path.HOME);
      } else {
        router.replace(path.NOTIFICATIONS);
      }
    } catch (err: any) {
      console.error('Failed to create account:', err);

      // Once the account exists, only the client-side steps after it are left
      // to retry, whatever the server would now say about the email.
      const accountCreated = createdAccountRef.current !== null;
      const recovery = accountCreated ? 'retry' : getAccountCreationRecovery(err);

      // Account creation sets up the Safe client against our bundler and RPC, and
      // viem's text for a failure there includes the request URL — which for the
      // bundler carries its API key — so the raw message is never shown.
      const errorMessage =
        recovery === 'verify_email'
          ? 'Your email verification has expired. Verify your email again to finish creating your account.'
          : recovery === 'log_in'
            ? 'An account with this email already exists. Log in to continue.'
            : isRateLimitedError(err)
              ? 'Too many attempts. Wait a minute, then try again.'
              : userFacingErrorMessage(
                  err,
                  accountCreated
                    ? "We couldn't finish setting up your wallet. Please try again."
                    : 'Failed to create account. Please try again.',
                );

      setError(errorMessage);

      track(TRACKING_EVENTS.SIGNUP_FAILED, {
        email,
        error: redactSecrets(err?.message || errorMessage),
        step: 'creating',
        // `wallet`: the account was created and the Safe address that
        // follows it failed. `account`: the server did not create it.
        failed_stage: accountCreated ? 'wallet' : 'account',
        recovery,
        status: getAccountCreationStatus(err),
        attempt: attemptRef.current,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      Sentry.captureException(err, {
        tags: {
          type: 'signup_account_creation_error',
          signup_recovery: recovery,
          signup_failed_stage: accountCreated ? 'wallet' : 'account',
        },
        extra: { email, attempt: attemptRef.current },
      });

      // A handle claimed between the availability check and this request is
      // fixed by picking another one. The passkey is kept: the username step
      // comes straight back here with it.
      if (!isSharedReviewAccess && recovery === 'choose_username') {
        setStep('username');
        router.replace(path.SIGNUP_USERNAME);
        return;
      }

      // The server never received a passkey, so there is none to reuse.
      if (recovery === 'new_passkey') {
        const retryStep = isSharedReviewAccess ? 'otp' : 'passkey';
        setStep(retryStep);
        router.replace(isSharedReviewAccess ? path.SIGNUP_OTP : path.SIGNUP_PASSKEY);
        return;
      }

      setFailure({
        recovery: recovery === 'choose_username' ? 'retry' : recovery,
        message: errorMessage,
        attempt: attemptRef.current,
        accountCreated,
      });
    } finally {
      isAttemptInFlightRef.current = false;
    }
  };

  const handleFailureAction = async () => {
    if (!failure) return;
    switch (failure.recovery) {
      case 'verify_email':
        // Send the new code now, so the next screen only has to ask for it.
        // The username and passkey are kept, and once the code is in, the
        // username step comes straight back here with them.
        try {
          const { otpId } = await initSignupOtp(email);
          setOtpId(otpId);
          setLastOtpSentAt(Date.now());
          track(TRACKING_EVENTS.EMAIL_OTP_REQUESTED, { email, context: 'signup_reverify' });
        } catch (otpError) {
          // The code screen has its own resend.
          console.error('Failed to resend signup OTP:', otpError);
        }
        setStep('otp');
        router.replace(path.SIGNUP_OTP);
        return;
      case 'log_in':
        router.replace(path.ONBOARDING);
        return;
      default:
        createAccount();
    }
  };

  const handleNewPasskey = () => {
    setStep('passkey');
    router.replace(path.SIGNUP_PASSKEY);
  };

  // Wait for stores to hydrate before rendering
  if (!_hasHydrated || !userStoreHydrated) {
    return null;
  }

  if (failure) {
    return (
      // Keyed apart from the progress view below: on web, React reused that
      // view's nodes and the title kept the old line's `text-white/60`.
      <SafeAreaView key="failure" className="flex-1 bg-background text-foreground">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[400px] items-center">
            <Text className="mb-4 text-center text-[30px] font-semibold leading-[34px] -tracking-[1px] text-white">
              {FAILURE_TITLES[failure.recovery]}
            </Text>
            <View className="mb-3 flex-row items-center gap-2">
              <InfoError />
              <Text className="flex-shrink text-sm text-red-400">{failure.message}</Text>
            </View>
            {failure.recovery === 'retry' && !isSharedReviewAccess ? (
              <Text className="mb-8 text-center text-base text-white/60">
                Your passkey is ready, so you won&apos;t need to create another one.
              </Text>
            ) : (
              <View className="mb-8" />
            )}
            <Button
              variant="brand"
              className="h-14 w-full rounded-xl"
              onPress={handleFailureAction}
            >
              <Text className="text-base font-semibold text-black">
                {FAILURE_ACTIONS[failure.recovery]}
              </Text>
            </Button>
            {failure.recovery === 'retry' &&
            !isSharedReviewAccess &&
            !failure.accountCreated &&
            failure.attempt >= NEW_PASSKEY_AFTER_ATTEMPTS ? (
              <Button variant="ghost" className="mt-3 h-12 w-full" onPress={handleNewPasskey}>
                <Text className="text-base font-semibold text-white/70">
                  Create a new passkey instead
                </Text>
              </Button>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView key="creating" className="flex-1 bg-background text-foreground">
      <View className="flex-1 items-center justify-center px-4">
        {/* Header section */}
        <View className="mb-10 items-center">
          <Text className="mb-2 text-[16px] text-white/60">Please wait</Text>
          <Text className="text-center text-[34px] font-semibold -tracking-[1px] text-white md:text-4xl">
            Creating your wallet
          </Text>
        </View>

        {/* Animated wallet icon */}
        <WalletLoadingIcon />
      </View>
    </SafeAreaView>
  );
}
