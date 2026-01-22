import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { Chain, hashTypedData, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { ERRORS } from '@/constants/errors';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { getAmplitudeDeviceId, track, trackIdentity } from '@/lib/analytics';
import { deleteAccount, login, updateSafeAddress, usernameExists } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID, USER } from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { pimlicoClient } from '@/lib/pimlico';
import { Status, User } from '@/lib/types';
import { getNonce, isHTTPError, setGlobalLogoutHandler, withRefreshToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import { useActivityStore } from '@/store/useActivityStore';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useBalanceStore } from '@/store/useBalanceStore';
import { useKycStore } from '@/store/useKycStore';
import { useUserStore } from '@/store/useUserStore';

import { fetchIsDeposited } from './useAnalytics';
import { fetchPoints } from '@/lib/api';

interface UseUserReturn {
  user: User | undefined;
  handleSignupStarted: (username: string, inviteCode: string) => Promise<void>;
  handleLogin: () => Promise<void>;
  handleDummyLogin: () => Promise<void>;
  handleSelectUserById: (userId: string) => Promise<void>;
  handleLogout: () => void;
  handleRemoveUsers: () => void;
  handleDeleteAccount: () => Promise<void>;
  safeAA: (
    chain: Chain,
    subOrganization: string,
    signWith: string,
    turnkeyClient?: any,
  ) => Promise<SmartAccountClient>;
  checkBalance: (user: User) => Promise<boolean>;
}

const useUser = (): UseUserReturn => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const intercom = useIntercom();
  const { httpClient, createHttpClient, createPasskey } = useTurnkey();

  const {
    user,
    users,
    storeUser,
    updateUser,
    selectUserById,
    unselectUser,
    removeUsers,
    setSignupInfo,
    setLoginInfo,
    setSignupUser,
    markSafeAddressSynced,
  } = useUserStore(
    useShallow(state => ({
      users: state.users,
      storeUser: state.storeUser,
      updateUser: state.updateUser,
      selectUserById: state.selectUserById,
      unselectUser: state.unselectUser,
      removeUsers: state.removeUsers,
      setSignupInfo: state.setSignupInfo,
      setLoginInfo: state.setLoginInfo,
      setSignupUser: state.setSignupUser,
      markSafeAddressSynced: state.markSafeAddressSynced,
      user: state.users.find((u: User) => u.selected),
    })),
  );

  const clearKycLinkId = useKycStore(state => state.clearKycLinkId);
  const removeEvents = useActivityStore(state => state.removeEvents);
  const clearBalance = useBalanceStore(state => state.clearBalance);

  const safeAA = useCallback(
    async (chain: Chain, subOrganization: string, signWith: string) => {
      // Create a passkey-specific HTTP client that always requires passkey signing
      // This ensures every transaction requires explicit user confirmation via passkey
      const passkeyClient = createHttpClient({
        defaultStamperType: StamperType.Passkey,
      });

      const turnkeyAccount = await createAccount({
        client: passkeyClient,
        organizationId: subOrganization,
        signWith: signWith,
      });

      // WORKAROUND: Fix @turnkey/viem signTypedData bug
      // The SDK's signTypedData sends the hash to Turnkey with PAYLOAD_ENCODING_EIP712,
      // but Turnkey expects JSON typed data. This causes Turnkey to sign wrong data.
      // Fix: Compute hash locally, use the account's `sign` method for raw hash signing.
      // TODO: Remove this workaround when @turnkey/viem fixes the bug
      if (turnkeyAccount.sign) {
        const originalSign = turnkeyAccount.sign.bind(turnkeyAccount);
        turnkeyAccount.signTypedData = async (typedData: any) => {
          const hash = hashTypedData(typedData);
          return originalSign({ hash });
        };
      }

      // Create a wallet client from the turnkeyAccount
      // const smartAccountOwner = createWalletClient({
      //   account: turnkeyAccount,
      //   transport: http(rpcUrls[chain.id]),
      //   chain: chain,
      // });

      const safeAccount = await toSafeSmartAccount({
        saltNonce: await getNonce({
          appId: 'solid',
        }),
        client: publicClient(chain.id),
        owners: [turnkeyAccount],
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
    [createHttpClient, user?.userId, user?.safeAddress],
  );

  const checkBalance = useCallback(
    async (user: User): Promise<boolean> => {
      try {
        const depositCount = await fetchIsDeposited(queryClient, user.safeAddress);
        const isDeposited = depositCount > 0;
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

  const handleLogin = useCallback(async () => {
    // Get attribution context for login tracking
    const attributionStore = useAttributionStore.getState();
    const attributionData = attributionStore.getAttributionForEvent();
    const deviceId = getAmplitudeDeviceId();

    try {
      setLoginInfo({ status: Status.PENDING });

      // Ensure httpClient is initialized
      if (!httpClient) {
        console.error('[handleLogin] Turnkey client not initialized');
        throw new Error('Turnkey client is not initialized. Please wait and try again.');
      }

      // Get a signed whoami request to identify the user's sub-organization
      // Uses passkey stamping - prompts user for passkey confirmation
      const stamp = await httpClient.stampGetWhoami(
        { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
        StamperType.Passkey,
      );

      // Step 3: Authenticate with our backend using the signed request
      const user = await login(stamp);

      const smartAccountClient = await safeAA(mainnet, user.subOrganizationId, user.walletAddress);

      if (!user.safeAddress || user.safeAddress === '') {
        console.warn('[useUser] updating safe address on login (missing on user)', {
          userId: user._id,
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
              id: user._id,
              address: smartAccountClient.account.address,
            },
          });
        }

        // Mark as synced to avoid repeated attempts elsewhere
        markSafeAddressSynced(user._id);
      }

      const selectedUser: User = {
        safeAddress: smartAccountClient.account.address,
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
        credentialId: user.credentialId,
      };
      storeUser(selectedUser);
      await checkBalance(selectedUser);

      // Identify user in analytics with full attribution context
      trackIdentity(user.userId, {
        username: user.username,
        safe_address: smartAccountClient.account.address,
        email: user.email,
        has_referral_code: !!user.referralCode,
        login_method: 'passkey',
        platform: Platform.OS,
        device_id: deviceId,
        ...attributionData,
        attribution_channel: getAttributionChannel(attributionData),
      });

      // Fetch points after successful login
      try {
        await withRefreshToken(() => fetchPoints());
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
        user_id: user.userId,
        username: user.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!user.email,
        is_deposited: !!user.isDeposited,
        device_id: deviceId,
        ...attributionData,
        attribution_channel: getAttributionChannel(attributionData),
      });

      // Update user properties on login with attribution
      trackIdentity(user.userId, {
        username: user.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!user.email,
        is_deposited: !!user.isDeposited,
        last_login_date: new Date().toISOString(),
        platform: Platform.OS,
        device_id: deviceId,
        ...attributionData,
        attribution_channel: getAttributionChannel(attributionData),
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
        device_id: deviceId,
        ...attributionData,
        attribution_channel: getAttributionChannel(attributionData),
      });

      console.error(error);
      setLoginInfo({ status: Status.ERROR, message: errorMessage });

      // Reset to IDLE after showing error for 3 seconds
      setTimeout(() => {
        setLoginInfo({ status: Status.IDLE, message: '' });
      }, 3000);

      // Re-throw so callers can handle (e.g., redirect to signup)
      throw error;
    }
  }, [
    checkBalance,
    setLoginInfo,
    storeUser,
    router,
    safeAA,
    markSafeAddressSynced,
    httpClient,
    login,
  ]);

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

    // Go to onboarding on native, welcome on web
    if (Platform.OS === 'web') {
      router.replace(path.WELCOME);
    } else {
      router.replace(path.ONBOARDING);
    }
  }, [unselectUser, clearKycLinkId, router, user]);

  // New: select user by userId (preferred for email-first users)
  const handleSelectUserById = useCallback(
    async (userId: string) => {
      const previousUserId = user?.userId;
      clearKycLinkId();

      // Find the selected user
      const selectedUser = users.find(u => u.userId === userId);
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
        user_id: userId,
        username: selectedUser?.username,
        email: selectedUser?.email,
      });

      // Always require passkey authentication on all platforms
      try {
        if (!httpClient) {
          throw new Error('Turnkey client is not initialized. Please wait and try again.');
        }

        const result = await httpClient.stampGetWhoami(
          { organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID },
          StamperType.Passkey,
        );

        const authedUser = await login(result);

        // If returned user is different, select by userId
        if (authedUser?._id && authedUser._id === userId) {
          selectUserById(authedUser._id);
        }

        router.replace(path.HOME);
      } catch (error) {
        // Revert to previous user or clear selection on auth failure
        if (previousUserId) {
          selectUserById(previousUserId);
        } else {
          unselectUser();
        }
        // Don't navigate on error - stay on welcome screen
      }
    },
    [selectUserById, clearKycLinkId, router, user, unselectUser, users, httpClient, login],
  );

  const handleRemoveUsers = useCallback(() => {
    track(TRACKING_EVENTS.FORGOT_ALL_USERS, {
      usernames: users.map((user: User) => user.username),
    });
    removeUsers();
    clearKycLinkId(); // Clear KYC data when removing all users
    removeEvents();
    router.replace(path.ONBOARDING);
  }, [removeUsers, clearKycLinkId, router]);

  const handleSessionExpired = useCallback(() => {
    clearKycLinkId(); // Clear KYC data when session expires
    router.replace({ pathname: '/welcome', params: { session: 'expired' } });
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
  }, [removeUsers, clearKycLinkId, queryClient, router, user]);

  useEffect(() => {
    setGlobalLogoutHandler(handleSessionExpired);
  }, [handleSessionExpired]);

  return {
    user,
    handleSignupStarted,
    handleLogin,
    handleDummyLogin,
    handleSelectUserById,
    handleLogout,
    handleRemoveUsers,
    handleDeleteAccount,
    safeAA,
    checkBalance,
  };
};

export default useUser;
