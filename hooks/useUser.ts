import {
  getWebAuthnValidator,
  RHINESTONE_ATTESTER_ADDRESS,
} from "@rhinestone/module-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { PublicKey } from "ox";
import { createSmartAccountClient } from "permissionless";
import {
  toSafeSmartAccount
} from "permissionless/accounts";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { useCallback, useEffect, useMemo } from "react";
import * as passkeys from "react-native-passkeys";
import { toAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import { path } from "@/constants/path";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "@/lib/api";
import { USER } from "@/lib/config";
import { pimlicoClient } from "@/lib/pimlico";
import { PasskeyArgType, Status, User } from "@/lib/types";
import {
  bufferToBase64URLString,
  decodePublicKey,
  getNonce,
  setGlobalLogoutHandler,
  withRefreshToken,
} from "@/lib/utils";
import { publicClient } from "@/lib/wagmi";
import { useUserStore } from "@/store/useUserStore";
import { Chain, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { fetchIsDeposited } from "./useAnalytics";

interface UseUserReturn {
  user: User | undefined;
  handleSignup: (username: string, inviteCode: string) => Promise<void>;
  handleLogin: () => Promise<void>;
  handleDummyLogin: () => Promise<void>;
  handleSelectUser: (username: string) => void;
  handleLogout: () => void;
  handleRemoveUsers: () => void;
  safeAA: (passkey: PasskeyArgType, chain: Chain) => Promise<any>;
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

  const user = useMemo(() => users.find((user: User) => user.selected), [users]);

  const safeAA = useCallback(async (passkey: PasskeyArgType, chain: Chain) => {
    const { x, y, prefix } = PublicKey.from({
      prefix: 4,
      x: BigInt(passkey.coordinates.x),
      y: BigInt(passkey.coordinates.y),
    });
    const webauthnValidator = getWebAuthnValidator({
      pubKey: { x, y, prefix },
      authenticatorId: passkey.credentialId,
    });

    const deadOwner = toAccount({
      address: "0x000000000000000000000000000000000000dead",
      async signMessage() {
        return "0x";
      },
      async signTransaction() {
        return "0x";
      },
      async signTypedData() {
        return "0x";
      },
    });

    const safeAccount = await toSafeSmartAccount({
      saltNonce: await getNonce({
        appId: 'solid',
      }),
      client: publicClient(chain.id),
      owners: [deadOwner],
      version: "1.4.1",
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
      safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
      erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
      attesters: [
        RHINESTONE_ATTESTER_ADDRESS,
      ],
      attestersThreshold: 1,
      validators: [
        {
          address: webauthnValidator.address,
          context: webauthnValidator.initData,
        },
      ],
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
    }).extend(erc7579Actions());
  }, []);

  const checkBalance = useCallback(async (user: User) => {
    try {
      const isDeposited = await fetchIsDeposited(queryClient, user.safeAddress);
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
  }, [queryClient, router, updateUser]);

  const handleSignup = useCallback(async (username: string, inviteCode: string) => {
    try {
      setSignupInfo({ status: Status.PENDING });

      const optionsJSON = await generateRegistrationOptions(username, inviteCode);

      const authenticatorResponse = await passkeys.create(optionsJSON);
      if (!authenticatorResponse) {
        throw new Error("Error while creating passkey registration");
      }

      const publicKeyData = authenticatorResponse.response.getPublicKey();
      if (!publicKeyData) {
        throw new Error("Failed to get public key from authenticator response");
      }

      // Handle platform differences - mobile returns base64 string, web returns ArrayBuffer
      const publicKey =
        typeof publicKeyData === "string"
          ? publicKeyData // Already base64 encoded on mobile
          : bufferToBase64URLString(publicKeyData); // Convert ArrayBuffer to base64 on web

      const coordinates = await decodePublicKey(authenticatorResponse.response);

      const smartAccountClient = await safeAA(
        {
          rawId: authenticatorResponse.rawId,
          credentialId: authenticatorResponse.id,
          coordinates: coordinates,
        },
        mainnet
      );

      const sessionId = optionsJSON.sessionId;

      const user = await withRefreshToken(
        () =>
          verifyRegistration(
            {
              ...authenticatorResponse,
              response: {
                ...authenticatorResponse.response,
                publicKey,
              },
            },
            sessionId,
            smartAccountClient.account.address,
          ),
        { onError: handleLogin }
      );

      if (user) {
        const selectedUser = { ...user, selected: true };
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
  }, [checkBalance, safeAA, setSignupInfo, storeUser]);

  const handleLogin = useCallback(async () => {
    try {
      setLoginInfo({ status: Status.PENDING });
      const optionsJSON = await generateAuthenticationOptions();
      const authenticatorResponse = await passkeys.get(optionsJSON);
      if (!authenticatorResponse) {
        throw new Error("Error while creating passkey authentication");
      }

      const sessionId = optionsJSON.sessionId;
      const user = await verifyAuthentication(authenticatorResponse, sessionId);

      if (user) {
        const selectedUser = { ...user, selected: true };
        storeUser(selectedUser);
        await checkBalance(selectedUser);
        setLoginInfo({ status: Status.SUCCESS });
      } else {
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
        safeAddress: "0x0000000000000000000000000000000000000000",
        selected: true,
        passkey: {
          rawId: "dummy",
          coordinates: {
            x: "dummy",
            y: "dummy",
          },
          credentialId: "dummy",
        },
      });
      router.replace(path.HOME);
    } catch (error) {
    }
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