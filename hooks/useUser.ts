import { useQueryClient } from '@tanstack/react-query';
import { TurnkeyClient } from '@turnkey/http';
import { PasskeyStamper } from '@turnkey/react-native-passkey-stamper';
import { createAccount } from '@turnkey/viem';
import { WebauthnStamper } from '@turnkey/webauthn-stamper';
import { useRouter } from 'expo-router';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chain, createWalletClient, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';

import { getRuntimeRpId } from '@/components/TurnkeyProvider';
import { path } from '@/constants/path';
import { getSubOrgIdByUsername, login, signUp, updateSafeAddress } from '@/lib/api';
import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
  USER,
} from '@/lib/config';
import { pimlicoClient } from '@/lib/pimlico';
import { Status, User } from '@/lib/types';
import { getNonce, setGlobalLogoutHandler, withRefreshToken } from '@/lib/utils';
import { publicClient, rpcUrls } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';
import { Platform } from 'react-native';
import { fetchIsDeposited } from './useAnalytics';

interface UseUserReturn {
  user: User | undefined;
  handleSignup: (username: string, inviteCode: string) => Promise<void>;
  handleLogin: () => Promise<void>;
  handleDummyLogin: () => Promise<void>;
  handleSelectUser: (username: string) => void;
  handleLogout: () => void;
  handleRemoveUsers: () => void;
  safeAA: (chain: Chain, subOrganization: string, signWith: string) => Promise<SmartAccountClient>;
  checkBalance: (user: User) => Promise<boolean>;
}

const useUser = (): UseUserReturn => {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const user = useMemo(() => users.find((user: User) => user.selected), [users]);

  const safeAA = useCallback(
    async (chain: Chain, subOrganization: string, signWith: string) => {
      let stamper: WebauthnStamper | PasskeyStamper;
      const rpId = getRuntimeRpId();

      console.log("🔐 safeAA - Creating passkey stamper with RP ID:", rpId);
      console.log("🔐 safeAA - Platform:", Platform.OS);

      if (Platform.OS === "web") {
        console.log("🌐 Creating WebauthnStamper for web");
        stamper = new WebauthnStamper({
          rpId: rpId,
          timeout: 60000,
        });
      } else {
        console.log("📱 Creating PasskeyStamper for iOS");
        stamper = new PasskeyStamper({
          rpId: rpId,
        });
      }

      const turnkeyClient = new TurnkeyClient(
        { baseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL },
        stamper
      );

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
          appId: "solid",
        }),
        client: publicClient(chain.id),
        owners: [smartAccountOwner.account],
        version: "1.4.1",
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7",
        },
      });

      return createSmartAccountClient({
        account: safeAccount,
        chain: chain,
        paymaster: pimlicoClient(chain.id),
        userOperation: {
          estimateFeesPerGas: async () =>
            (await pimlicoClient(chain.id).getUserOperationGasPrice()).fast,
        },
        bundlerTransport: http(USER.pimlicoUrl(chain.id)),
      });
    },
    []
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
          throw new Error('Username already exists');
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
          const rpId = getRuntimeRpId();
          console.log("📱 handleSignup - iOS passkey creation");
          console.log("📱 handleSignup - RP ID:", rpId);
          console.log("📱 handleSignup - Passkey name:", passkeyName);

          //@ts-ignore
          const { createPasskey } = await import(
            "@turnkey/react-native-passkey-stamper"
          );

          console.log("📱 handleSignup - About to call createPasskey with config:");
          console.log("📱 handleSignup - authenticatorName: End-User Passkey");
          console.log("📱 handleSignup - rp.id:", rpId);
          console.log("📱 handleSignup - rp.name: Solid");

          try {
            const passkey = await createPasskey({
              authenticatorName: "End-User Passkey",
              rp: {
                id: rpId,
                name: "Solid",
              },
              user: {
                id: uuidv4(),
                name: passkeyName,
                displayName: passkeyName,
              },
            });

            console.log("✅ handleSignup - Passkey created successfully");
            console.log("📱 handleSignup - Challenge:", passkey.challenge ? "present" : "missing");
            console.log("📱 handleSignup - Attestation:", passkey.attestation ? "present" : "missing");

            challenge = passkey.challenge;
            attestation = passkey.attestation;
          } catch (error) {
            console.error("❌ handleSignup - Passkey creation failed:", error);
            throw error;
          }
        }

        if (!challenge || !attestation) {
          throw new Error('Error creating passkey');
        }

        const user = await signUp(username, challenge, attestation, inviteCode);

        const smartAccountClient = await safeAA(
          mainnet,
          user.subOrganizationId,
          user.walletAddress,
        );

        if (smartAccountClient && user) {
          const selectedUser: User = {
            safeAddress: smartAccountClient.account.address,
            username,
            userId: user.turnkeyUserId,
            signWith: user.walletAddress,
            suborgId: user.subOrganizationId,
            selected: true,
            tokens: user.tokens || null,
          };
          storeUser(selectedUser);
          await checkBalance(selectedUser);
          const resp = await withRefreshToken(() =>
            updateSafeAddress(smartAccountClient.account.address),
          );
          if (!resp) {
            throw new Error('Error updating safe address');
          }
          setSignupInfo({ status: Status.SUCCESS });

          // On mobile, navigate to notifications for new signups
          if (Platform.OS === 'web') {
            router.replace(path.HOME);
          } else {
            router.replace(path.NOTIFICATIONS);
          }
        } else {
          throw new Error('Error while verifying passkey registration');
        }
      } catch (error: any) {
        let message = '';
        if (error?.status === 409 || error.message?.includes('Username already exists')) {
          message = 'Username already exists';
        } else if ((await error?.text?.())?.toLowerCase()?.includes('invite')) {
          message = 'Invalid invite code';
        }

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
      const selectedUser: User = {
        safeAddress: smartAccountClient.account.address,
        username: user.username,
        userId: user.turnkeyUserId,
        signWith: user.walletAddress,
        suborgId: user.subOrganizationId,
        selected: true,
        tokens: user.tokens || null,
        email: user.email,
      };
      storeUser(selectedUser);
      await checkBalance(selectedUser);
      setLoginInfo({ status: Status.SUCCESS });

      router.replace(path.HOME);
    } catch (error: any) {
      console.error(error);
      setLoginInfo({ status: Status.ERROR });
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
    } catch (error) { }
  }, [router, storeUser]);

  const handleLogout = useCallback(() => {
    unselectUser();
    router.replace(path.WELCOME);
  }, [unselectUser, router]);

  const handleSelectUser = useCallback(
    (username: string) => {
      selectUser(username);
      router.replace(path.HOME);
    },
    [selectUser, router],
  );

  const handleRemoveUsers = useCallback(() => {
    removeUsers();
    router.replace(path.REGISTER);
  }, [removeUsers, router]);

  const handleSessionExpired = useCallback(() => {
    router.replace({
      pathname: path.REGISTER,
      params: { session: 'expired' },
    });
  }, [router]);

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
    safeAA,
    checkBalance,
  };
};

export default useUser;
