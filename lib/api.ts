import axios, { AxiosRequestHeaders } from "axios";
import { Platform } from "react-native";
import {
  AuthenticationResponseJSON
} from "react-native-passkeys/src/ReactNativePasskeys.types";
import { fuse } from "viem/chains";

import { useUserStore } from "@/store/useUserStore";
import {
  EXPO_PUBLIC_ALCHEMY_API_KEY,
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_API_BASE_URL,
} from "./config";
import {
  BlockscoutTransactions,
  BridgeCustomerResponse,
  CardResponse,
  CardStatus,
  CardStatusResponse,
  KycLink,
  LayerZeroTransaction,
  TokenPriceUsd,
  User
} from "./types";
import { explorerUrls } from "./utils";

// Helper function to get platform-specific headers
const getPlatformHeaders = () => {
  const headers: Record<string, string> = {};
  if (Platform.OS === "ios" || Platform.OS === "android") {
    headers["X-Platform"] = "mobile";
  }
  return headers;
};

// Helper function to get JWT token for mobile
const getJWTToken = (): string | null => {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const { users } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);
    return currentUser?.tokens?.accessToken || null;
  }
  return null;
};

// Helper function to get refresh token
const getRefreshToken = (): string | null => {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const { users } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);
    return currentUser?.tokens?.refreshToken || null;
  }
  return null;
};

// Set up axios interceptor to add headers to all axios requests
axios.interceptors.request.use((config) => {
  const platformHeaders = getPlatformHeaders();

  config.headers = {
    ...config.headers,
    ...platformHeaders,
  } as AxiosRequestHeaders;

  if (Platform.OS === "ios" || Platform.OS === "android") {
    const jwtToken = getJWTToken();

    if (jwtToken) {
      config.headers["Authorization"] = `Bearer ${jwtToken}`;
    } else {
      console.error("No JWT token found");
    }
  }

  return config;
});

export const refreshToken = () => {
  const refreshTokenValue = getRefreshToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getPlatformHeaders(),
  };

  if (refreshTokenValue) {
    headers["Authorization"] = `Bearer ${refreshTokenValue}`;
  }

  return fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/refresh-token`,
    {
      method: "POST",
      credentials: "include",
      headers,
    }
  );
};

// use fetch because some browser doesn't support fetch wrappers such as axios
// see: https://simplewebauthn.dev/docs/advanced/browser-quirks#safari
export const signUp = async (
  username: string,
  challenge: string,
  attestation: any,
  inviteCode: string
) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/sign-up`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ username, challenge, attestation, inviteCode }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const updateSafeAddress = async (
  safeAddress: string,
) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/update-safe-address`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ safeAddress }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const verifyRegistration = async (
  sessionId: string,
  address: string
): Promise<User> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/registration/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({
        sessionId,
        address,
      }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const generateAuthenticationOptions = async () => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/authentication/generate-options`,
    {
      credentials: "include",
      headers: {
        ...getPlatformHeaders(),
      },
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const verifyAuthentication = async (
  authenticationResponse: AuthenticationResponseJSON,
  sessionId: string
): Promise<User> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/authentication/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({
        ...authenticationResponse,
        sessionId,
      }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const fetchTotalAPY = async () => {
  const response = await axios.get<number>(
    `${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/yields/total-apy`
  );
  return response.data;
};

export const fetchTokenTransfer = async ({
  address,
  token,
  type = "ERC-20",
  filter = "to",
  explorerUrl = explorerUrls[fuse.id].blockscout,
}: {
  address: string;
  token?: string;
  type?: string;
  filter?: string;
  explorerUrl?: string;
}) => {
  let url = `${explorerUrl}/api/v2/addresses/${address}/token-transfers`;
  let params = [];

  if (type) params.push(`type=${type}`);
  if (filter) params.push(`filter=${filter}`);
  if (token) params.push(`token=${token}`);

  if (params.length) url += `?${params.join("&")}`;

  const response = await axios.get<BlockscoutTransactions>(url);
  return response.data;
};

export const fetchTokenPriceUsd = async (token: string) => {
  const response = await axios.get<TokenPriceUsd>(
    `https://api.g.alchemy.com/prices/v1/${EXPO_PUBLIC_ALCHEMY_API_KEY}/tokens/by-symbol?symbols=${token}`
  );
  return response?.data?.data[0]?.prices[0]?.value;
};

export const createKycLink = async (
  fullName: string,
  email: string,
  redirectUri: string
): Promise<KycLink> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        fullName,
        email,
        redirectUri,
      }),
    }
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getKycLink = async (kycLinkId: string): Promise<KycLink> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link/${kycLinkId}`,
    {
      credentials: "include",
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    }
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getCustomer = async (): Promise<BridgeCustomerResponse | null> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-customer`,
    {
      credentials: "include",
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    }
  );

  if (response.status === 404) return null;

  if (!response.ok) throw response;

  return response.json();
};

export const createCard = async (): Promise<CardResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: "include",
    }
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getCardStatus = async (): Promise<CardStatusResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/status`,
    {
      credentials: "include",
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    }
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getCardDetails = async (): Promise<CardResponse> => {
  return {
    id: "123",
    client_reference_id: "123",
    customer_id: "123",
    card_image_url: "https://www.google.com",
    status: CardStatus.ACTIVE,
    status_reason: "123",
    balances: {
      available: {
        amount: "123.12",
        currency: "USD",
      },
      hold: {
        amount: "100",
        currency: "USD",
      },
    },
    card_details: {
      last_4: "1234",
      expiry: "12/2025",
      bin: "123456",
    },
    freezes: [],
    crypto_account: {
      address: "0x1234567890",
      type: "ERC-20",
    },
    funding_instructions: {
      currency: "USD",
      chain: "ETH",
      address: "0x1234567890",
      memo: "123",
    },
  };

  // const jwt = getJWTToken();

  // const response = await fetch(
  // 	`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/details`,
  // 	{
  // 		credentials: "include",
  // 		headers: {
  // 			...getPlatformHeaders(),
  // 			...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  // 		},
  // 	},
  // );

  // if (!response.ok) throw response;

  // return response.json();
};

export const fetchInternalTransactions = async (
  address: string,
): Promise<BlockscoutTransactions> => {
  const response = await axios.get(
    `https://eth.blockscout.com/api/v2/addresses/${address}/internal-transactions?filter=from`,
  );
  return response.data;
};

export const fetchTransactionTokenTransfers = async (
  transactionHash: string,
  type = "ERC-20",
): Promise<BlockscoutTransactions> => {
  const response = await axios.get(
    `https://eth.blockscout.com/api/v2/transactions/${transactionHash}/token-transfers?type=${type}`,
  );
  return response.data;
};

export const fetchLayerZeroBridgeTransactions = async (
  transactionHash: string
): Promise<LayerZeroTransaction> => {
  const response = await axios.get(
    `https://scan.layerzero-api.com/v1/messages/tx/${transactionHash}`
  );
  return response.data;
};

export const getClientIp = async () => {
  try {
    const response = await axios.get("https://api.ipify.org?format=json");
    return response.data.ip;
  } catch (error) {
    console.error("Error fetching IP from ipify:", error);
  }
};

export const getSubOrgIdByUsername = async (username: string) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/sub-org-id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({
        filterType: "USERNAME",
        filterValue: username,
      }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};

export const login = async (
  username: string,
  signedRequest: any,
) => {
  // const body = JSON.parse(signedRequest.body);
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/log-in`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlatformHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({
        username,
        ...signedRequest,
      }),
    }
  );
  if (!response.ok) throw response;
  return response.json();
};