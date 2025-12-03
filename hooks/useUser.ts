import { StamperType } from '@/components/TurnkeyProvider';
import { ERRORS } from '@/constants/errors';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track, trackIdentity } from '@/lib/analytics';
import {
  deleteAccount,
  getSubOrgIdByUsername,
  login,
  signUp,
  updateSafeAddress,
  updateUserCredentialId,
  usernameExists,
} from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
  USER
} from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { pimlicoClient } from '@/lib/pimlico';
import { Status, User } from '@/lib/types';
import {
  getNonce,
  isHTTPError,
  parseStampHeaderValueCredentialId,
  setGlobalLogoutHandler,
  withRefreshToken
} from '@/lib/utils';
import { getReferralCodeForSignup } from '@/lib/utils/referral';
import { publicClient, rpcUrls } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';
import { useBalanceStore } from '@/store/useBalanceStore';
import { useKycStore } from '@/store/useKycStore';
import { usePointsStore } from '@/store/usePointsStore';
import { useUserStore } from '@/store/useUserStore';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';
import { useRouter } from 'expo-router';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Chain, createWalletClient, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';
import { fetchIsDeposited } from './useAnalytics';

interface UseUserReturn {
  user: User | undefined;
  handleSignupStarted: (username: string, inviteCode: string) => Promise<void>;
  handleSignup: (username: string, inviteCode: string) => Promise<void>;
  handleLogin: () => Promise<void>;
  handleDummyLogin: () => Promise<void>;
  handleSelectUser: (username: string) => void;
  handleLogout: () => void;
  handleRemoveUsers: () => void;
  handleDeleteAccount: () => Promise<void>;
  safeAA: (chain: Chain, subOrganization: string, signWith: string) => Promise<SmartAccountClient>;
  checkBalance: (user: User) => Promise<boolean>;
}

const useUser = (): UseUserReturn => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const intercom = useIntercom();

  // Get Turnkey client from the new SDK
  // httpClient is the base client, we'll pass StamperType.Passkey to operations that need passkey auth
  const { httpClient, createPasskey, logout } = useTurnkey();

  const {
    users,
    storeUser,
    updateUser,
    selectUser,
    unselectUser,
    removeUsers,
    setSignupInfo,
    setLoginInfo,
    setSignupUser,
    markSafeAddressSynced,
  } = useUserStore();

  const { clearKycLinkId } = useKycStore();
  const { removeEvents } = useActivityStore();
  const { clearBalance } = useBalanceStore();

  const user = useMemo(() => users.find((user: User) => user.selected), [users]);

  const safeAA = useCallback(
    async (chain: Chain, subOrganization: string, signWith: string) => {
      if (!httpClient) {
        throw new Error('Turnkey client not initialized');
      }

      // The httpClient uses passkey stamping for signing operations
      const turnkeyAccount = await createAccount({
        client: httpClient,
        organizationId: subOrganization,
        signWith: signWith,
      });

      // Create a wallet client from the turnkeyAccount
      const smartAccountOwner = createWalletClient({
        account: turnkeyAccount,
        transport: http(rpcUrls[chain.id]),
        chain: chain,
      });

      const safeAccount = await toSafeSmartAccount({
        saltNonce: await getNonce({
          appId: 'solid',
        }),
        client: publicClient(chain.id),
        owners: [smartAccountOwner.account],
        version: '1.4.1',
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7',
        },
      });

      const bundlerClient = pimlicoClient(chain.id);

      return createSmartAccountClient({
        account: safeAccount,
        chain: chain,
        paymaster: bundlerClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            try {
              const gasPrice = await bundlerClient.getUserOperationGasPrice();
              return gasPrice.fast;
            } catch (error) {
              console.error('Failed to get gas price:', error);
              Sentry.captureException(error, {
                tags: {
                  type: 'gas_price_estimation_error',
                  chainId: chain.id,
                },
                user: {
                  id: user?.userId,
                  address: user?.safeAddress,
                },
              });
              throw error;
            }
          },
        },
        bundlerTransport: http(USER.pimlicoUrl(chain.id)),
      });
    },
    [httpClient, user?.userId, user?.safeAddress],
  );

  const checkBalance = useCallback(
    async (user: User): Promise<boolean> => {
      try {
        const isDeposited = await fetchIsDeposited(queryClient, user.safeAddress);
        if (isDeposited) {
          updateUser({
            ...user,
            isDeposited: true,
          });
        }
        return isDeposited;
      } catch (error) {
        console.error('Error fetching tokens:', error);
        Sentry.captureException(new Error('Error fetching tokens'), {
          tags: {
            type: 'token_fetch_error',
          },
          extra: {
            error,
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });
        return false;
      }
    },
    [queryClient, updateUser],
  );

  const handleSignupStarted = useCallback(
    async (username: string, inviteCode: string) => {
      try {
        setSignupInfo({ status: Status.PENDING });
        track(TRACKING_EVENTS.SIGNUP_STARTED, {
          username,
        });

        const response = await usernameExists(username);
        if (!isHTTPError(response, 404)) {
          throw response;
        }

        setSignupUser({ username, inviteCode });
        // router.push(path.INVITE);
      } catch (error: any) {
        let message = 'Error checking username exists';

        if (isHTTPError(error, 200)) {
          message = ERRORS.USERNAME_ALREADY_EXISTS;
          Sentry.captureMessage(message, {
            level: 'warning',
            extra: {
              username,
              inviteCode,
              error,
            },
          });
        } else {
          Sentry.captureException(new Error(message), {
            extra: {
              username,
              inviteCode,
              error,
            },
          });
        }

        setSignupInfo({ status: Status.ERROR, message });
        console.error(message, error);
      }
    },
    [setSignupInfo, setSignupUser, router],
  );

  const handleSignup = useCallback(
    async (username: string, inviteCode: string) => {
      track(TRACKING_EVENTS.SIGNUP_STARTED, {
        username,
      });
      try {
        setSignupInfo({ status: Status.PENDING });
        const subOrgId = await getSubOrgIdByUsername(username);

        if (subOrgId.organizationId) {
          throw new Error(ERRORS.USERNAME_ALREADY_EXISTS);
        }

        // Use the unified createPasskey from the new SDK
        // This works on both web and native platforms automatically
        const passkey = await createPasskey({
          name: username,
        });

        const { encodedChallenge: challenge, attestation } = passkey;
        const credentialId = attestation.credentialId;

        if (!challenge || !attestation) {
          const error = new Error('Error creating passkey');
          Sentry.captureException(error, {
            tags: {
              type: 'passkey_creation_error',
            },
            extra: {
              username,
              inviteCode,
            },
          });
          throw error;
        }

        // Get referral code from storage (if any)
        const referralCode = getReferralCodeForSignup() || '';

        const userResponse = await signUp(
          username,
          challenge,
          attestation,
          inviteCode,
          referralCode,
          credentialId,
        );

        const smartAccountClient = await safeAA(
          mainnet,
          userResponse.subOrganizationId,
          userResponse.walletAddress,
        );

        if (smartAccountClient && userResponse) {
          const selectedUser: User = {
            safeAddress: smartAccountClient.account.address,
            username,
            userId: userResponse._id,
            signWith: userResponse.walletAddress,
            suborgId: userResponse.subOrganizationId,
            selected: true,
            tokens: userResponse.tokens || null,
            referralCode: userResponse.referralCode,
            turnkeyUserId: userResponse.turnkeyUserId,
            credentialId,
          };
          storeUser(selectedUser);

          // Identify user in analytics
          trackIdentity(userResponse.userId, {
            username,
            safe_address: smartAccountClient.account.address,
            has_referral_code: !!userResponse.referralCode,
            signup_method: 'passkey',
            platform: Platform.OS,
          });

          // Track successful signup completion
          track(TRACKING_EVENTS.SIGNUP_COMPLETED, {
            user_id: userResponse._id,
            username,
            invite_code: inviteCode,
            referral_code: referralCode,
            safe_address: smartAccountClient.account.address,
          });

          setSignupInfo({ status: Status.SUCCESS });

          // Navigate immediately - let usePostSignupInit handle the rest
          // On mobile, navigate to notifications for new signups
          if (Platform.OS === 'web') {
            router.replace(path.HOME);
          } else {
            router.replace(path.NOTIFICATIONS);
          }
        } else {
          Sentry.captureException(new Error('Error while verifying passkey registration'));
          const error = new Error('Error while verifying passkey registration');
          Sentry.captureException(error, {
            tags: {
              type: 'passkey_verification_error',
            },
            extra: {
              username,
            },
          });
          throw error;
        }
      } catch (error: any) {
        let message = '';

        // Check for WebAuthn-specific errors first
        if (error?.name === 'NotAllowedError' || error?.message?.includes('not allowed')) {
          message = 'Passkey creation was cancelled or blocked by your browser. Please try again.';
        } else if (
          error?.name === 'TimeoutError' ||
          error?.message?.includes('timeout') ||
          error?.message?.includes('timed out')
        ) {
          message =
            'Passkey creation timed out. Please try again and complete the authentication prompt.';
        } else if (error?.name === 'InvalidStateError') {
          message = 'This passkey already exists. Please try logging in instead.';
        } else if (
          error?.name === 'NotSupportedError' ||
          error?.message?.includes('not supported')
        ) {
          message = 'Passkeys are not supported in your current browser or context.';
        } else if (error?.message?.includes('embedded context')) {
          message = 'Passkey creation is not supported in embedded or iframe context.';
        } else if (
          error?.status === 409 ||
          error.message?.includes(ERRORS.USERNAME_ALREADY_EXISTS)
        ) {
          message = ERRORS.USERNAME_ALREADY_EXISTS;
        } else if ((await error?.text?.())?.toLowerCase()?.includes('invite')) {
          message = ERRORS.INVALID_INVITE_CODE;
        }

        if (message) {
          Sentry.captureMessage(message, {
            level: 'warning',
            extra: {
              username,
              inviteCode,
              error,
              errorName: error?.name,
              errorMessage: error?.message,
            },
          });
        } else {
          Sentry.captureException(new Error('Error signing up'), {
            extra: {
              username,
              inviteCode,
              error,
              errorName: error?.name,
              errorMessage: error?.message,
            },
          });
        }

        track(TRACKING_EVENTS.SIGNUP_FAILED, {
          username,
          invite_code: inviteCode,
          error: error.message || error.name || 'Unknown error',
        });

        setSignupInfo({ status: Status.ERROR, message });
        console.error(error);
      }
    },
    [createPasskey, checkBalance, safeAA, setSignupInfo, storeUser, router],
  );

  const handleLogin = useCallback(async () => {
    try {
      setLoginInfo({ status: Status.PENDING });

      if (!httpClient) {
        throw new Error('Turnkey client not initialized');
      }

      // Use passkey stamping for authentication
      const stamp = await httpClient.stampGetWhoami(
        { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
        StamperType.Passkey,
      );

      let credentialId: string | undefined;
      if (stamp?.stamp?.stampHeaderValue) {
        credentialId = parseStampHeaderValueCredentialId(stamp.stamp.stampHeaderValue);
      }

      const userResponse = await login(stamp);

      const smartAccountClient = await safeAA(
        mainnet,
        userResponse.subOrganizationId,
        userResponse.walletAddress,
      );

      if (!userResponse.safeAddress || userResponse.safeAddress === '') {
        console.warn('[useUser] updating safe address on login (missing on user)', {
          userId: userResponse._id,
          safeAddress: smartAccountClient.account.address,
        });

        const resp = await withRefreshToken(() =>
          updateSafeAddress(smartAccountClient.account.address),
        );

        if (!resp) {
          const error = new Error('Error updating safe address on login');

          Sentry.captureException(error, {
            tags: {
              type: 'safe_address_update_error',
            },
            user: {
              id: userResponse._id,
              address: smartAccountClient.account.address,
            },
          });
        }

        // Mark as synced to avoid repeated attempts elsewhere
        markSafeAddressSynced(userResponse._id);
      }

      // For backward compatibility: if user doesn't have credentialId stored, update it
      if (credentialId && !userResponse.credentialId) {
        try {
          await withRefreshToken(() => updateUserCredentialId(credentialId));
        } catch (error) {
          console.error('Failed to update credentialId for existing user:', error);
        }
      }

      const selectedUser: User = {
        safeAddress: smartAccountClient.account.address,
        username: userResponse.username,
        userId: userResponse._id,
        signWith: userResponse.walletAddress,
        suborgId: userResponse.subOrganizationId,
        selected: true,
        tokens: userResponse.tokens || null,
        email: userResponse.email,
        referralCode: userResponse.referralCode,
        turnkeyUserId: userResponse.turnkeyUserId,
        credentialId: credentialId || userResponse.credentialId,
      };
      storeUser(selectedUser);
      await checkBalance(selectedUser);

      // Identify user in analytics
      trackIdentity(userResponse.userId, {
        username: userResponse.username,
        safe_address: smartAccountClient.account.address,
        email: userResponse.email,
        has_referral_code: !!userResponse.referralCode,
        login_method: 'passkey',
        platform: Platform.OS,
      });

      // Fetch points after successful login
      try {
        const { fetchPoints } = usePointsStore.getState();
        await fetchPoints();
      } catch (error) {
        console.warn('Failed to fetch points:', error);
        Sentry.captureException(new Error('Error fetching points'), {
          extra: {
            error,
          },
        });
        // Don't fail login if points fetch fails
      }

      setLoginInfo({ status: Status.SUCCESS });
      track(TRACKING_EVENTS.LOGGED_IN, {
        user_id: userResponse.userId,
        username: userResponse.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!userResponse.email,
        is_deposited: !!userResponse.isDeposited,
      });

      // Update user properties on login
      trackIdentity(userResponse.userId, {
        username: userResponse.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!userResponse.email,
        is_deposited: !!userResponse.isDeposited,
        last_login_date: new Date().toISOString(),
        platform: Platform.OS,
      });

      router.replace(path.HOME);
    } catch (error: any) {
      let errorMessage =
        error?.status === 404
          ? 'User not found, please sign up'
          : error?.message || 'Network request timed out';

      if (error?.name === 'NotAllowedError') {
        errorMessage = 'User cancelled login';
        Sentry.captureMessage(errorMessage, {
          level: 'warning',
          extra: {
            error,
          },
        });
      } else {
        Sentry.captureException(new Error('Error logging in'), {
          extra: {
            error,
            errorMessage,
          },
        });
      }

      track(TRACKING_EVENTS.LOGIN_FAILED, {
        username: user?.username,
        error: error.message,
      });

      console.error(error);
      setLoginInfo({ status: Status.ERROR, message: errorMessage });

      // Reset to IDLE after showing error for 3 seconds
      setTimeout(() => {
        setLoginInfo({ status: Status.IDLE, message: '' });
      }, 3000);
    }
  }, [httpClient, checkBalance, setLoginInfo, storeUser, router, safeAA, markSafeAddressSynced]);

  const handleDummyLogin = useCallback(async () => {
    try {
      await storeUser({
        username: 'dummy',
        signWith: 'dummy',
        suborgId: 'dummy',
        userId: 'dummy',
        safeAddress: '0x0000000000000000000000000000000000000000',
        selected: true,
        email: 'dummy@dummy.com',
      });
      router.replace(path.HOME);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          type: 'dummy_login_error',
        },
        level: 'warning',
      });
    }
  }, [router, storeUser]);

  const handleLogout = useCallback(() => {
    track(TRACKING_EVENTS.LOGGED_OUT, {
      user_id: user?.userId,
      username: user?.username,
    });
    clearBalance();
    unselectUser();
    clearKycLinkId(); // Clear KYC data on logout
    intercom?.shutdown();
    intercom?.boot();
    logout();

    // Go to onboarding on native, welcome on web
    if (Platform.OS === 'web') {
      router.replace(path.WELCOME);
    } else {
      router.replace(path.ONBOARDING);
    }
  }, [unselectUser, clearKycLinkId, router, user, intercom, clearBalance]);

  const handleSelectUser = useCallback(
    (username: string) => {
      const previousUsername = user?.username;
      selectUser(username);
      clearKycLinkId();

      // Find the selected user to get their userId
      const selectedUser = users.find(u => u.username === username);
      if (selectedUser) {
        // Re-identify with the selected user
        trackIdentity(selectedUser.userId, {
          username: selectedUser.username,
          safe_address: selectedUser.safeAddress,
          email: selectedUser.email,
          platform: Platform.OS,
        });
      }

      track(TRACKING_EVENTS.WELCOME_USER, {
        user_id: selectedUser?.userId,
        username: username,
      });

      // We reauth if web to get a new session cookie
      // and bind it to the selected user
      const reauthIfWeb = async () => {
        if (Platform.OS === 'web' && httpClient) {
          try {
            // Use passkey stamping for re-authentication
            const result = await httpClient.stampGetWhoami(
              { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
              StamperType.Passkey,
            );

            let credentialId: string | undefined;
            if (result?.stamp?.stampHeaderValue) {
              credentialId = parseStampHeaderValueCredentialId(result.stamp.stampHeaderValue);
            }

            const authedUser = await login(result);

            // For backward compatibility: if user doesn't have credentialId stored, update it
            if (credentialId && !authedUser.credentialId) {
              try {
                await withRefreshToken(() => updateUserCredentialId(credentialId));
                await updateUser({ ...selectedUser!, credentialId });
              } catch (error) {
                console.error('Failed to update credentialId for existing user:', error);
              }
            }

            if (authedUser?.username && authedUser.username !== username) {
              selectUser(authedUser.username);
            }
          } catch (error) {
            if (previousUsername) {
              selectUser(previousUsername);
            } else {
              unselectUser();
            }
          }
        }
      };

      void reauthIfWeb().finally(() => {
        router.replace(path.HOME);
      });
    },
    [httpClient, selectUser, clearKycLinkId, router, user, unselectUser, users, updateUser],
  );

  const handleRemoveUsers = useCallback(() => {
    track(TRACKING_EVENTS.FORGOT_ALL_USERS, {
      usernames: users.map((user: User) => user.username),
    });
    removeUsers();
    clearKycLinkId(); // Clear KYC data when removing all users
    removeEvents();
    router.replace(path.REGISTER);
  }, [removeUsers, clearKycLinkId, router, removeEvents, users]);

  const handleSessionExpired = useCallback(() => {
    clearKycLinkId(); // Clear KYC data when session expires
    router.replace(`${path.REGISTER}?session=expired`);
  }, [clearKycLinkId, router]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await withRefreshToken(deleteAccount);

      track(TRACKING_EVENTS.DELETE_ACCOUNT, {
        usernames: users.map((user: User) => user.username),
      });

      // Clear all user data
      removeUsers();
      clearKycLinkId();
      queryClient.clear();

      // Navigate to welcome screen
      router.replace(path.WELCOME);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }, [removeUsers, clearKycLinkId, queryClient, router, users]);

  useEffect(() => {
    setGlobalLogoutHandler(handleSessionExpired);
  }, [handleSessionExpired]);

  return {
    user,
    handleSignupStarted,
    handleSignup,
    handleLogin,
    handleDummyLogin,
    handleSelectUser,
    handleLogout,
    handleRemoveUsers,
    handleDeleteAccount,
    safeAA,
    checkBalance,
  };
};

export default useUser;
