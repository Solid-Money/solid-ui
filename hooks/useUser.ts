import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SmartAccountClient, createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { useCallback, useEffect, useMemo } from "react";
import { mainnet } from "viem/chains";

import { getRuntimeRpId } from "@/components/TurnkeyProvider";
import { path } from "@/constants/path";
import {
  getSubOrgIdByUsername,
  login,
  signUp
} from "@/lib/api";
import { EXPO_PUBLIC_TURNKEY_API_BASE_URL, EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID, USER } from "@/lib/config";
import { pimlicoClient } from "@/lib/pimlico";
import { Status, User } from "@/lib/types";
import {
  getNonce,
  setGlobalLogoutHandler
} from "@/lib/utils";
import { publicClient, rpcUrls } from "@/lib/wagmi";
import { useUserStore } from "@/store/useUserStore";
import { TurnkeyClient } from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-browser";
import { createAccount } from "@turnkey/viem";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { Chain, createWalletClient, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { fetchIsDeposited } from "./useAnalytics";

interface UseUserReturn {
  user: User | undefined;
  handleSignup: (username: string, inviteCode: string) => Promise<void>;
  handleLogin: (username: string) => Promise<void>;
  handleDummyLogin: () => Promise<void>;
  handleSelectUser: (username: string) => void;
  handleLogout: () => void;
  handleRemoveUsers: () => void;
  safeAA: (chain: Chain, subOrganization: string, signWith: string) => Promise<SmartAccountClient>;
  checkBalance: (user: User) => Promise<void>;
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

  const user = useMemo(
    () => users.find((user: User) => user.selected),
    [users]
  );

  const turnkey = new Turnkey({
    apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
    defaultOrganizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
    rpId: getRuntimeRpId(),
  })

  const passkeyClient = turnkey.passkeyClient();

  const safeAA = useCallback(
    async (chain: Chain, subOrganization: string, signWith: string) => {
      const session = await turnkey.getSession()
      console.log("Session:", session);
      const stamper = new WebauthnStamper({
        rpId: getRuntimeRpId(),
        timeout: 60000,
      });

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
      })
    },
    []
  );

  const checkBalance = useCallback(
    async (user: User) => {
      try {
        const isDeposited = await fetchIsDeposited(
          queryClient,
          user.safeAddress
        );
        if (isDeposited) {
          updateUser({
            ...user,
            isDeposited: true,
          });
          router.replace(path.HOME);
          return;
        }
      } catch (error) {
        console.error("Error fetching tokens:", error);
      }
      router.replace(path.HOME);
    },
    [queryClient, router, updateUser]
  );

  const handleSignup = useCallback(
    async (username: string, inviteCode: string) => {

      try {
        setSignupInfo({ status: Status.PENDING });

        const passkeyName = `${getRuntimeRpId()}-${username}`;
        const { encodedChallenge, attestation } =
          (await passkeyClient?.createUserPasskey({
            publicKey: {
              user: {
                name: passkeyName,
                displayName: passkeyName,
              },
            },
          })) || {};

        if (!encodedChallenge || !attestation) {
          throw new Error("Error creating passkey");
        }

        const user = await signUp(
          username,
          encodedChallenge,
          attestation,
          inviteCode
        );

        const smartAccountClient = await safeAA(
          mainnet,
          user.subOrganizationId,
          user.walletAddress
        );

        if (smartAccountClient && user) {
          const selectedUser: User = {
            safeAddress: smartAccountClient.account.address,
            username,
            userId: user.turnkeyUserId,
            signWith: user.walletAddress,
            suborgId: user.subOrganizationId,
            selected: true,
          };
          storeUser(selectedUser);
          await checkBalance(selectedUser);
          setSignupInfo({ status: Status.SUCCESS });
        } else {
          throw new Error("Error while verifying passkey registration");
        }
      } catch (error: any) {
        let message = "";
        if (error?.status === 409) {
          message = "Username already exists";
        } else if ((await error?.text?.())?.toLowerCase()?.includes("invite")) {
          message = "Invalid invite code";
        }

        setSignupInfo({ status: Status.ERROR, message });
        console.error(error);
      }
    },
    [checkBalance, safeAA, setSignupInfo, storeUser]
  );

  const handleLogin = useCallback(async (username: string) => {
    try {
      setLoginInfo({ status: Status.PENDING });
      const subOrgId = await getSubOrgIdByUsername(username);

      if (subOrgId.organizationId) {
        const signedWhoamiRequest = await passkeyClient.stampGetWhoami({
          organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        });

        const user = await login(
          username,
          signedWhoamiRequest
        )

        const smartAccountClient = await safeAA(
          mainnet,
          user.subOrganizationId,
          user.walletAddress
        );
        const selectedUser: User = {
          safeAddress: smartAccountClient.account.address,
          username,
          userId: user.turnkeyUserId,
          signWith: user.walletAddress,
          suborgId: user.subOrganizationId,
          selected: true,
        };
        storeUser(selectedUser);
        await checkBalance(selectedUser);
        setLoginInfo({ status: Status.SUCCESS });
      }
      else {
        throw new Error("Error while verifying passkey authentication");
      }
    } catch (error: any) {
      console.error(error);
      setLoginInfo({ status: Status.ERROR });
    }
  }, [checkBalance, setLoginInfo, storeUser]);

  const handleDummyLogin = useCallback(async () => {
    try {
      await storeUser({
        username: "dummy",
        signWith: "dummy",
        suborgId: "dummy",
        userId: "dummy",
        safeAddress: "0x0000000000000000000000000000000000000000",
        selected: true,
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
    [selectUser, router]
  );

  const handleRemoveUsers = useCallback(() => {
    removeUsers();
    router.replace(path.REGISTER);
  }, [removeUsers, router]);

  useEffect(() => {
    setGlobalLogoutHandler(handleLogout);
  }, [handleLogout]);

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
