import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track, trackIdentity } from '@/lib/analytics';
import { deleteAccount, getSubOrgIdByUsername, login, signUp, updateSafeAddress } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
  USER,
} from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { pimlicoClient } from '@/lib/pimlico';
import { Status, User } from '@/lib/types';
import { getNonce, setGlobalLogoutHandler, withRefreshToken } from '@/lib/utils';
import { getReferralCodeForSignup } from '@/lib/utils/referral';
import { publicClient, rpcUrls } from '@/lib/wagmi';
import { useKycStore } from '@/store/useKycStore';
import { usePointsStore } from '@/store/usePointsStore';
import { useUserStore } from '@/store/useUserStore';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { TurnkeyClient } from '@turnkey/http';
import { PasskeyStamper } from '@turnkey/react-native-passkey-stamper';
import { createAccount } from '@turnkey/viem';
import { WebauthnStamper } from '@turnkey/webauthn-stamper';
import { useRouter } from 'expo-router';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { Chain, createWalletClient, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';
import { fetchIsDeposited } from './useAnalytics';

interface UseUserReturn {
  user: User | undefined;
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

  const {
    users,
    storeUser,
    updateUser,
    selectUser,
    unselectUser,
    removeUsers,
    setSignupInfo,
    setLoginInfo,
  } = useUserStore();

  const { clearKycLinkId } = useKycStore();

  const user = useMemo(() => users.find((user: User) => user.selected), [users]);

  const safeAA = useCallback(async (chain: Chain, subOrganization: string, signWith: string) => {
    let stamper: WebauthnStamper | PasskeyStamper;

    if (Platform.OS === 'web') {
      stamper = new WebauthnStamper({
        rpId: getRuntimeRpId(),
        timeout: 60000,
      });
    } else {
      stamper = new PasskeyStamper({
        rpId: getRuntimeRpId(),
      });
    }

    const turnkeyClient = new TurnkeyClient({ baseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL }, stamper);

    const turnkeyAccount = await createAccount({
      client: turnkeyClient,
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
  }, []);

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

  const handleSignup = useCallback(
    async (username: string, inviteCode: string) => {
      try {
        setSignupInfo({ status: Status.PENDING });
        const subOrgId = await getSubOrgIdByUsername(username);

        if (subOrgId.organizationId) {
          const error = new Error('Username already exists');
          Sentry.captureException(error, {
            tags: {
              type: 'signup_username_exists',
            },
            extra: {
              username,
            },
          });
          throw error;
        }

        const passkeyName = username;
        let challenge: any;
        let attestation: any;

        if (Platform.OS === 'web') {
          // Dynamically import browser SDK only when needed
          //@ts-ignore
          const { Turnkey } = await import('@turnkey/sdk-browser');
          const turnkey = new Turnkey({
            apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
            defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
            rpId: getRuntimeRpId(),
          });

          const passkeyClient = turnkey.passkeyClient();
          const passkey = await passkeyClient.createUserPasskey({
            publicKey: {
              user: {
                name: passkeyName,
                displayName: passkeyName,
              },
            },
          });
          challenge = passkey.encodedChallenge;
          attestation = passkey.attestation;
        } else {
          // Use the already imported React Native passkey stamper
          //@ts-ignore
          const { createPasskey } = await import('@turnkey/react-native-passkey-stamper');
          const passkey = await createPasskey({
            authenticatorName: 'End-User Passkey',
            rp: {
              id: getRuntimeRpId(),
              name: 'Solid',
            },
            user: {
              id: uuidv4(),
              name: passkeyName,
              displayName: passkeyName,
            },
          });
          challenge = passkey.challenge;
          attestation = passkey.attestation;
        }

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
        const referralCode = getReferralCodeForSignup() || undefined;

        const user = await signUp(username, challenge, attestation, inviteCode, referralCode);

        const smartAccountClient = await safeAA(
          mainnet,
          user.subOrganizationId,
          user.walletAddress,
        );

        if (smartAccountClient && user) {
          const selectedUser: User = {
            safeAddress: smartAccountClient.account.address,
            username,
            userId: user._id,
            signWith: user.walletAddress,
            suborgId: user.subOrganizationId,
            selected: true,
            tokens: user.tokens || null,
            referralCode: user.referralCode,
            turnkeyUserId: user.turnkeyUserId,
          };
          storeUser(selectedUser);
          await checkBalance(selectedUser);

          // Identify user in analytics
          trackIdentity(user.userId, {
            username,
            safe_address: smartAccountClient.account.address,
            has_referral_code: !!user.referralCode,
            signup_method: 'passkey',
            platform: Platform.OS,
            is_deposited: !!user.isDeposited,
          });

          const resp = await withRefreshToken(() =>
            updateSafeAddress(smartAccountClient.account.address),
          );
          if (!resp) {
            const error = new Error('Error updating safe address on signup');
            Sentry.captureException(error, {
              tags: {
                type: 'safe_address_update_error',
              },
              extra: {
                username,
              },
              user: {
                id: user?.userId,
                address: user?.safeAddress,
              },
            });
            throw error;
          }

          // Fetch points after successful signup
          try {
            const { fetchPoints } = usePointsStore.getState();
            await fetchPoints();
          } catch (error) {
            console.warn('Failed to fetch points:', error);
            Sentry.captureException(error, {
              tags: {
                type: 'points_fetch_error_signup',
              },
              user: {
                id: user?.userId,
                address: user?.safeAddress,
              },
              level: 'warning',
            });
            Sentry.captureException(new Error('Error fetching points on signup'), {
              extra: {
                error,
              },
            });
            // Don't fail signup if points fetch fails
          }

          setSignupInfo({ status: Status.SUCCESS });

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
        track(TRACKING_EVENTS.SIGNUP_COMPLETED, {
          user_id: user?.userId,
          username,
          invite_code: inviteCode,
          referral_code: referralCode,
          safe_address: smartAccountClient?.account?.address,
        });
      } catch (error: any) {
        let message = '';
        if (error?.status === 409 || error.message?.includes('Username already exists')) {
          message = 'Username already exists';
        } else if ((await error?.text?.())?.toLowerCase()?.includes('invite')) {
          message = 'Invalid invite code';
        }
        Sentry.captureException(new Error('Error signing up'), {
          extra: {
            error,
            message,
          },
        });
        track(TRACKING_EVENTS.SIGNUP_FAILED, {
          username,
          invite_code: inviteCode,
          error: error.message,
        });

        setSignupInfo({ status: Status.ERROR, message });
        console.error(error);
      }
    },
    [checkBalance, safeAA, setSignupInfo, storeUser, router],
  );

  const handleLogin = useCallback(async () => {
    try {
      setLoginInfo({ status: Status.PENDING });
      let stamp: any;

      if (Platform.OS === 'web') {
        // Dynamically import browser SDK only when needed
        //@ts-ignore
        const { Turnkey } = await import('@turnkey/sdk-browser');
        const turnkey = new Turnkey({
          apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
          defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
          rpId: getRuntimeRpId(),
        });

        const passkeyClient = turnkey.passkeyClient();
        stamp = await passkeyClient.stampGetWhoami({
          organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        });
      } else {
        const stamper = new PasskeyStamper({
          rpId: getRuntimeRpId(),
        });
        const turnkeyClient = new TurnkeyClient(
          { baseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL },
          stamper,
        );
        stamp = await turnkeyClient.stampGetWhoami({
          organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        });
      }

      const user = await login(stamp);

      const smartAccountClient = await safeAA(mainnet, user.subOrganizationId, user.walletAddress);

      if (!user.safeAddress || user.safeAddress == '') {
        const resp = await withRefreshToken(() =>
          updateSafeAddress(smartAccountClient.account.address),
        );
        if (!resp) {
          const error = new Error('Error updating safe address on login');
          Sentry.captureException(error, {
            tags: {
              type: 'safe_address_update_error',
            },
          });
        }
      }

      const selectedUser: User = {
        safeAddress: smartAccountClient.account.address,
        username: user.username,
        userId: user._id,
        signWith: user.walletAddress,
        suborgId: user.subOrganizationId,
        selected: true,
        tokens: user.tokens || null,
        email: user.email,
        referralCode: user.referralCode,
        turnkeyUserId: user.turnkeyUserId,
      };
      storeUser(selectedUser);
      await checkBalance(selectedUser);

      // Identify user in analytics
      trackIdentity(user.userId, {
        username: user.username,
        safe_address: smartAccountClient.account.address,
        email: user.email,
        has_referral_code: !!user.referralCode,
        login_method: 'passkey',
        platform: Platform.OS,
      });

      try {
        if (!user.safeAddress) {
          await withRefreshToken(() => updateSafeAddress(smartAccountClient.account.address));
        }
      } catch (error) {
        console.error('Error updating safe address:', error);
        Sentry.captureException(new Error('Error updating safe address'), {
          extra: {
            error,
          },
        });
      }

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
        user_id: user.userId,
        username: user.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!user.email,
        is_deposited: !!user.isDeposited,
      });

      // Update user properties on login
      trackIdentity(user.userId, {
        username: user.username,
        safe_address: smartAccountClient.account.address,
        has_email: !!user.email,
        is_deposited: !!user.isDeposited,
        last_login_date: new Date().toISOString(),
        platform: Platform.OS,
      });

      router.replace(path.HOME);
    } catch (error: any) {
      Sentry.captureException(new Error('Error logging in'), {
        extra: {
          error,
        },
      });
      track(TRACKING_EVENTS.LOGIN_FAILED, {
        username: user?.username,
        error: error.message,
      });
      console.error(error);
      const errorMessage = error?.message || 'Network request timed out';
      setLoginInfo({ status: Status.ERROR, message: errorMessage });

      // Reset to IDLE after showing error for 3 seconds
      setTimeout(() => {
        setLoginInfo({ status: Status.IDLE, message: '' });
      }, 3000);
    }
  }, [checkBalance, setLoginInfo, storeUser, router, safeAA]);

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
        if (Platform.OS === 'web') {
          try {
            //@ts-ignore
            const { Turnkey } = await import('@turnkey/sdk-browser');
            const turnkey = new Turnkey({
              apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
              defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
              rpId: getRuntimeRpId(),
            });
            const passkeyClient = turnkey.passkeyClient();
            const stamp = await passkeyClient.stampGetWhoami({
              organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
            });
            const authedUser = await login(stamp);
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
    [selectUser, clearKycLinkId, router, user, unselectUser, users],
  );

  const handleRemoveUsers = useCallback(() => {
    track(TRACKING_EVENTS.FORGOT_ALL_USERS, {
      usernames: users.map((user: User) => user.username),
    });
    removeUsers();
    clearKycLinkId(); // Clear KYC data when removing all users
    router.replace(path.REGISTER);
  }, [removeUsers, clearKycLinkId, router]);

  const handleSessionExpired = useCallback(() => {
    clearKycLinkId(); // Clear KYC data when session expires
    router.replace({
      pathname: path.REGISTER,
      params: { session: 'expired' },
    });
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
