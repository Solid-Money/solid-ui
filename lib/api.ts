import * as Sentry from '@sentry/react-native';
import axios, { AxiosRequestHeaders } from 'axios';
import { Platform } from 'react-native';
import { fuse } from 'viem/chains';

import { explorerUrls } from '@/constants/explorers';
import { BridgeApiTransfer } from '@/lib/types/bank-transfer';
import { useUserStore } from '@/store/useUserStore';
import {
  EXPO_PUBLIC_ALCHEMY_API_KEY,
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_API_BASE_URL,
  EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL,
  EXPO_PUBLIC_LIFI_API_URL,
} from './config';
import {
  BlockscoutTransactions,
  BridgeCustomerEndorsement,
  BridgeCustomerResponse,
  BridgeDeposit,
  BridgeTransaction,
  BridgeTransactionRequest,
  BridgeTransferResponse,
  CardResponse,
  CardStatusResponse,
  CardTransactionsResponse,
  CustomerFromBridgeResponse,
  Deposit,
  ExchangeRateResponse,
  FromCurrency,
  GetLifiQuoteParams,
  KycLink,
  KycLinkForExistingCustomer,
  KycLinkFromBridgeResponse,
  LayerZeroTransaction,
  LifiQuoteResponse,
  Points,
  ToCurrency,
  TokenPriceUsd,
  User,
} from './types';

// Helper function to get platform-specific headers
const getPlatformHeaders = () => {
  const headers: Record<string, string> = {};
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    headers['X-Platform'] = 'mobile';
  }
  return headers;
};

// Helper function to get JWT token for mobile
const getJWTToken = (): string | null => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { users } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);
    return currentUser?.tokens?.accessToken || null;
  }
  return null;
};

// Helper function to get refresh token
const getRefreshToken = (): string | null => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { users } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);
    return currentUser?.tokens?.refreshToken || null;
  }
  return null;
};

// Set up axios interceptor to add headers to all axios requests
axios.interceptors.request.use(config => {
  const platformHeaders = getPlatformHeaders();

  config.headers = {
    ...config.headers,
    ...platformHeaders,
  } as AxiosRequestHeaders;

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const jwtToken = getJWTToken();

    if (jwtToken) {
      config.headers['Authorization'] = `Bearer ${jwtToken}`;
    } else {
      console.error('No JWT token found');
      Sentry.captureMessage('No JWT token found', {
        level: 'warning',
        tags: {
          type: 'auth_token_missing',
        },
      });
    }
  }

  return config;
});

// Set up axios response interceptor to handle errors
axios.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method;

    Sentry.captureException(error, {
      tags: {
        type: 'api_error',
        status: status?.toString(),
        method: method?.toUpperCase(),
      },
      extra: {
        url,
        responseData: error.response?.data,
      },
    });

    return Promise.reject(error);
  },
);

export const refreshToken = async () => {
  const refreshTokenValue = getRefreshToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getPlatformHeaders(),
  };

  if (refreshTokenValue) {
    headers['Authorization'] = `Bearer ${refreshTokenValue}`;
  }

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/refresh-token`,
    {
      method: 'POST',
      credentials: 'include',
      headers,
    },
  );

  if (!response.ok) throw response;

  return response;
};

// use fetch because some browser doesn't support fetch wrappers such as axios
// see: https://simplewebauthn.dev/docs/advanced/browser-quirks#safari
export const signUp = async (
  username: string,
  challenge: string,
  attestation: any,
  inviteCode: string,
  referralCode?: string,
) => {
  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/sign-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({ username, challenge, attestation, inviteCode, referralCode }),
  });
  if (!response.ok) throw response;
  return response.json();
};

export const updateSafeAddress = async (safeAddress: string) => {
  const jwt = getJWTToken();
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/update-safe-address`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ safeAddress }),
    },
  );
  if (!response.ok) throw response;
  return response.json();
};

export const fetchTotalAPY = async () => {
  const response = await axios.get<number>(
    `${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/yields/total-apy`,
  );
  return response.data;
};

export const fetchTokenTransfer = async ({
  address,
  token,
  type = 'ERC-20',
  filter = 'to',
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

  if (params.length) url += `?${params.join('&')}`;

  const response = await axios.get<BlockscoutTransactions>(url);
  return response.data;
};

export const fetchTokenPriceUsd = async (token: string) => {
  const response = await axios.get<TokenPriceUsd>(
    `https://api.g.alchemy.com/prices/v1/${EXPO_PUBLIC_ALCHEMY_API_KEY}/tokens/by-symbol?symbols=${token}`,
  );
  return response?.data?.data[0]?.prices[0]?.value;
};

export const createKycLink = async (
  fullName: string,
  email: string,
  redirectUri: string,
  endorsements: string[],
): Promise<KycLink> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({
      fullName,
      email,
      redirectUri,
      endorsements,
    }),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const getKycLink = async (kycLinkId: string): Promise<KycLink> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link/${kycLinkId}`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getKycLinkFromBridge = async (
  kycLinkId: string,
): Promise<KycLinkFromBridgeResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/kyc-link-from-bridge/${kycLinkId}`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

// The backend retrieves the customer by querying the database
export const getCustomer = async (): Promise<BridgeCustomerResponse | null> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-customer`, {
    credentials: 'include',
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });

  if (response.status === 404) return null;

  if (!response.ok) throw response;

  return response.json();
};

// The backend retrieves the customer by calling the Bridge API
export const getCustomerFromBridge = async (): Promise<CustomerFromBridgeResponse | null> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-customer/get-customer-from-bridge`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) throw response;

  return response.json();
};

export const getKycLinkForExistingCustomer = async (params: {
  endorsement: string;
  redirectUri: string;
}): Promise<KycLinkForExistingCustomer | null> => {
  const jwt = getJWTToken();

  const url = new URL('/accounts/v1/bridge-customer/kyc-link', EXPO_PUBLIC_FLASH_API_BASE_URL);

  url.search = new URLSearchParams({
    endorsement: params.endorsement,
    redirectUri: params.redirectUri,
  }).toString();

  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw response;

  return response.json();
};

export const getCustomerEndorsements = async (): Promise<BridgeCustomerEndorsement[] | null> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-customer/endorsements`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) throw response;

  return response.json();
};

export const createCard = async (): Promise<CardResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) throw response;

  return response.json();
};

export const getCardStatus = async (): Promise<CardStatusResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/status`, {
    credentials: 'include',
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });

  if (!response.ok) throw response;

  return response.json();
};

export const getCardDetails = async (): Promise<CardResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/details`, {
    credentials: 'include',
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });

  if (!response.ok) throw response;

  return response.json();
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
  type = 'ERC-20',
): Promise<BlockscoutTransactions> => {
  const response = await axios.get(
    `https://eth.blockscout.com/api/v2/transactions/${transactionHash}/token-transfers?type=${type}`,
  );
  return response.data;
};

export const fetchLayerZeroBridgeTransactions = async (
  transactionHash: string,
): Promise<LayerZeroTransaction> => {
  const response = await axios.get(
    `https://scan.layerzero-api.com/v1/messages/tx/${transactionHash}`,
  );
  return response.data;
};

export const getClientIp = async () => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching IP from ipify:', error);
  }
};

export const getSubOrgIdByUsername = async (username: string) => {
  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/sub-org-id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({
      filterType: 'USERNAME',
      filterValue: username,
    }),
  });
  if (!response.ok) throw response;
  return response.json();
};

export const fetchPoints = async (): Promise<Points> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/points/user-summary`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;
  return response.json();
};

export const login = async (signedRequest: any) => {
  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/log-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({
      ...signedRequest,
    }),
  });
  if (!response.ok) throw response;
  return response.json();
};

export const createMercuryoTransaction = async (
  userIp: string,
  transactionId: string,
): Promise<string> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/mercuryo/transactions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        userIp,
        transactionId,
      }),
    },
  );

  if (!response.ok) throw response;

  const data: { widgetUrl: string } = await response.json();
  return data.widgetUrl;
};

export const bridgeDeposit = async (
  bridge: BridgeDeposit,
): Promise<{ transactionHash: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(bridge),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const bridgeDepositTransactions = async (
  safeAddress: string,
): Promise<BridgeTransaction[]> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge/transactions/${safeAddress}`,
    {
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const initGenericOtp = async (
  email: string,
  otpLength?: number,
  alphanumeric?: boolean,
  userIdentifier?: string,
) => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/init-generic-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        email,
        ...(otpLength !== undefined && { otpLength }),
        ...(alphanumeric !== undefined && { alphanumeric }),
        ...(userIdentifier && { userIdentifier }),
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

export const createBridgeTransfer = async (params: {
  amount: string;
  sourcePaymentRail: string;
  fiatCurrency: string;
  cryptoCurrency: string;
}): Promise<BridgeTransferResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const verifyGenericOtp = async (otpId: string, otpCode: string, email: string) => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/verify-generic-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        otpId,
        otpCode,
        email,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

export const createDeposit = async (deposit: Deposit): Promise<{ transactionHash: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(deposit),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const deleteAccount = async (): Promise<{ success: boolean; message?: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/delete-account`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getExchangeRate = async (
  from: FromCurrency,
  to: ToCurrency,
): Promise<ExchangeRateResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-transfers/exchange-rate?from=${from}&to=${to}`,
    {
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getLifiQuote = async ({
  fromAddress,
  fromChain,
  toChain = 1,
  fromAmount,
  fromToken = 'USDC',
  toAddress,
  toToken = 'USDC',
}: GetLifiQuoteParams): Promise<LifiQuoteResponse> => {
  const response = await axios.get<LifiQuoteResponse>(`${EXPO_PUBLIC_LIFI_API_URL}/quote`, {
    params: {
      fromAddress,
      fromChain,
      toChain,
      fromAmount,
      fromToken,
      toAddress,
      toToken,
    },
  });

  return response?.data;
};

export const bridgeTransaction = async (bridge: BridgeTransactionRequest): Promise<Response> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge/transactions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(bridge),
    },
  );

  if (!response.ok) throw response;

  return response;
};

export const getBankTransfers = async (): Promise<BridgeApiTransfer[]> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-transfers/transactions`,
    {
      headers: {
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const freezeCard = async (): Promise<{ message: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/freeze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) throw response;

  return response.json();
};

export const unfreezeCard = async (): Promise<{ message: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/unfreeze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) throw response;

  return response.json();
};

export const getCardTransactions = async (
  paginationToken?: string,
): Promise<CardTransactionsResponse> => {
  const jwt = getJWTToken();

  const url = new URL('/accounts/v1/cards/transactions', EXPO_PUBLIC_FLASH_API_BASE_URL);
  if (paginationToken) {
    url.searchParams.append('pagination_token', paginationToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) throw response;

  return response.json();
};
