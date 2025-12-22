import * as Sentry from '@sentry/react-native';
import axios, { AxiosRequestHeaders } from 'axios';
import { Platform } from 'react-native';
import { fuse } from 'viem/chains';

import { explorerUrls } from '@/constants/explorers';
import { BridgeApiTransfer } from '@/lib/types/bank-transfer';
import { useUserStore } from '@/store/useUserStore';
import {
  EXPO_PUBLIC_ALCHEMY_API_KEY,
  EXPO_PUBLIC_BRIDGE_CARD_API_BASE_URL,
  EXPO_PUBLIC_COINGECKO_API_KEY,
  EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_API_BASE_URL,
  EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL,
  EXPO_PUBLIC_FLASH_VAULT_MANAGER_API_BASE_URL,
  EXPO_PUBLIC_LIFI_API_URL,
} from './config';
import {
  ActivityEvent,
  ActivityEvents,
  APYs,
  BlockscoutTransactions,
  BridgeCustomerEndorsement,
  BridgeCustomerResponse,
  BridgeDeposit,
  BridgeTransaction,
  BridgeTransactionRequest,
  BridgeTransferResponse,
  CardAccessResponse,
  CardDetailsResponseDto,
  CardDetailsRevealResponse,
  CardResponse,
  CardStatusResponse,
  CardTransaction,
  CardTransactionsResponse,
  CardWaitlistResponse,
  Cashback,
  ChartPayload,
  CoinHistoricalChart,
  CountryFromIp,
  CustomerFromBridgeResponse,
  Deposit,
  DepositBonusConfig,
  DepositTransaction,
  DirectDepositSessionResponse,
  EphemeralKeyResponse,
  ExchangeRateResponse,
  FromCurrency,
  GetLifiQuoteParams,
  KycLink,
  KycLinkForExistingCustomer,
  KycLinkFromBridgeResponse,
  LayerZeroTransaction,
  LeaderboardResponse,
  LifiOrder,
  LifiQuoteResponse,
  LifiStatusResponse,
  Points,
  SearchCoin,
  StargateQuoteParams,
  StargateQuoteResponse,
  SwapTokenRequest,
  SwapTokenResponse,
  SyncActivitiesOptions,
  SyncActivitiesResponse,
  ToCurrency,
  TokenPriceUsd,
  UpdateActivityEvent,
  User,
  VaultBreakdown,
} from './types';
import { generateClientNonceData } from './utils/cardDetailsReveal';

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
  credentialId?: string,
) => {
  let body: any = { username, challenge, attestation, inviteCode };
  if (referralCode) body.referralCode = referralCode;
  if (credentialId) body.credentialId = credentialId;
  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/sign-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(body),
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

export const addReferrer = async (referralCode: string) => {
  const jwt = getJWTToken();
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/add-referral-code`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ referralCode }),
    },
  );
  if (!response.ok) throw response;
  return response.json();
};

export const updateUserCredentialId = async (credentialId: string) => {
  const jwt = getJWTToken();
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/update-credential-id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ credentialId }),
    },
  );
  if (!response.ok) throw response;
  return response.json();
};

export const updateExternalWalletAddress = async (externalWalletAddress: string) => {
  const jwt = getJWTToken();
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/update-external-wallet-address`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ externalWalletAddress }),
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

export const getCardStatus = async (): Promise<CardStatusResponse | null> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/status`, {
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

export const getCardDetails = async (): Promise<CardDetailsResponseDto> => {
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

export const getCashbackPercentage = async (): Promise<{ percentage: number }> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/cashback-percentage`,
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

export const getClientIp = async (): Promise<string | null> => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching IP from ipify:', error);
    return null;
  }
};

export const checkCardAccess = async (countryCode: string): Promise<CardAccessResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/check-access?countryCode=${countryCode}`,
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

export const addToCardWaitlist = async (
  email: string,
  countryCode: string,
): Promise<CardWaitlistResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/card-waitlist`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getPlatformHeaders(),
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ email, countryCode }),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const addToCardWaitlistToNotify = async (
  email: string,
  countryCode: string,
): Promise<CardWaitlistResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/card-waitlist-to-notify`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify({ email, countryCode }),
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const checkCardWaitlistStatus = async (email: string): Promise<CardWaitlistResponse> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/card-waitlist/check?email=${encodeURIComponent(email)}`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const checkCardWaitlistToNotifyStatus = async (
  email: string,
): Promise<CardWaitlistResponse> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/card-waitlist-to-notify/check?email=${encodeURIComponent(email)}`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getCountryFromIp = async (): Promise<CountryFromIp | null> => {
  try {
    const response = await axios.get('https://ipapi.co/json/');
    const { country_code, country_name } = response.data;

    return {
      countryCode: country_code,
      countryName: country_name,
    };
  } catch (error) {
    console.error('Error fetching country from IP:', error);
    return null;
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

export const fetchLeaderboardUsers = async (params: {
  pageSize?: string;
  page?: string;
}): Promise<LeaderboardResponse> => {
  const jwt = getJWTToken();
  const searchParams = new URLSearchParams();

  if (params.pageSize) searchParams.append('pageSize', params.pageSize);
  if (params.page) searchParams.append('page', params.page);

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/points/leaderboard?${searchParams.toString()}`,
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

export const depositTransactions = async (safeAddress: string): Promise<DepositTransaction[]> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/deposit/transactions/${safeAddress}`,
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
  order = LifiOrder.FASTEST,
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
      order,
    },
  });

  return response?.data;
};

export const checkBridgeStatus = async (bridgeTxHash: string): Promise<LifiStatusResponse> => {
  const response = await axios.get<LifiStatusResponse>(`${EXPO_PUBLIC_LIFI_API_URL}/status`, {
    params: {
      txHash: bridgeTxHash,
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

export const getCashbacks = async (): Promise<Cashback[]> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/cashback`, {
    headers: {
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) throw response;

  return response.json();
};

export const getCardTransaction = async (transactionId: string): Promise<CardTransaction> => {
  const jwt = getJWTToken();

  const url = new URL(
    `/accounts/v1/cards/transactions/${transactionId}`,
    EXPO_PUBLIC_FLASH_API_BASE_URL,
  );

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

export const fetchTVL = async () => {
  const response = await axios.get<number>(
    `${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/bigquery-metrics/tvl`,
  );
  return response.data;
};

export const usernameExists = async (username: string) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/username/${username}`,
    {
      method: 'HEAD',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
      },
    },
  );
  return response;
};

// ============================================
// Email-First Signup Flow API Functions
// ============================================

/**
 * Step 1: Initiate OTP for signup (public - no auth required)
 * Checks if email is already registered before sending OTP
 */
export const initSignupOtp = async (email: string) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/init-signup-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
      },
      body: JSON.stringify({ email }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw data;
  return data as { otpId: string };
};

/**
 * Step 2: Verify OTP for signup (public - no auth required)
 * Returns verification token to use in emailSignUp
 */
export const verifySignupOtp = async (otpId: string, otpCode: string, email: string) => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/verify-signup-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
      },
      body: JSON.stringify({ otpId, otpCode, email }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw data;
  return data as { verificationToken: string; email: string };
};

/**
 * Step 3: Create account with email and passkey (public - no auth required)
 * Creates sub-org with passkey authenticator and wallet in a single step
 */
export const emailSignUp = async (
  email: string,
  verificationToken: string,
  sessionPublicKey: string,
  challenge: string,
  attestation: any,
  credentialId?: string,
  referralCode?: string,
  marketingConsent?: boolean,
) => {
  const body: Record<string, any> = {
    email,
    verificationToken,
    sessionPublicKey,
    challenge,
    attestation,
    marketingConsent,
  };
  if (credentialId) body.credentialId = credentialId;
  if (referralCode) body.referralCode = referralCode;

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/email-signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw response;
  return response.json();
};

/**
 * Check if email is already registered (public)
 * Returns true if email exists, false otherwise
 */
export const emailExists = async (email: string): Promise<boolean> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/email/${encodeURIComponent(email)}`,
    {
      method: 'HEAD',
      headers: {
        ...getPlatformHeaders(),
      },
    },
  );
  return response.status === 200;
};

export const createActivityEvent = async (
  event: ActivityEvent,
): Promise<{ transactionHash: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(event),
  });

  if (!response.ok) throw response;

  return response.json();
};

export const fetchActivityEvents = async (
  page: number = 1,
  limit: number = 30,
): Promise<ActivityEvents> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity?page=${page}&limit=${limit}`,
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

export const updateActivityEvent = async (
  clientTxId: string,
  event: UpdateActivityEvent,
): Promise<ActivityEvent> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity/${clientTxId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const bulkUpsertActivityEvent = async (
  events: ActivityEvent[],
): Promise<ActivityEvent[]> => {
  const jwt = getJWTToken();

  const response = await fetch(`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getPlatformHeaders(),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(events),
  });

  if (!response.ok) throw response;

  return response.json();
};

/**
 * Sync on-chain transactions from Blockscout for the user's wallet.
 * Fetches both token transfers and native transactions, then upserts them as activities.
 *
 * @param options - Optional parameters to customize the sync
 * @param options.chainIds - Array of chain IDs to sync (defaults to all supported: Fuse, Ethereum, Base)
 * @param options.direction - Transaction direction: 'from', 'to', or 'all' (default: 'all')
 * @param options.type - Transaction type: 'token', 'native', or 'all' (default: 'all')
 * @returns Sync result with counts of synced, skipped, and errored transactions
 */
export const syncActivities = async (
  options: SyncActivitiesOptions = {},
): Promise<SyncActivitiesResponse> => {
  const jwt = getJWTToken();

  const params = new URLSearchParams();

  if (options.chainIds?.length) {
    options.chainIds.forEach(chainId => params.append('chainIds[]', chainId.toString()));
  }
  if (options.direction) {
    params.append('direction', options.direction);
  }
  if (options.type) {
    params.append('type', options.type);
  }

  const queryString = params.toString();
  const url = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity/sync${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
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

export const fetchVaultBreakdown = async () => {
  const response = await axios.get<VaultBreakdown[]>(
    `${EXPO_PUBLIC_FLASH_VAULT_MANAGER_API_BASE_URL}/vault-manager/v1/tokens/vault-breakdown`,
  );
  return response.data;
};

// Card Details Reveal Functions

/**
 * Request ephemeral key from backend
 * Your backend will relay this nonce to Bridge and return the ephemeral key
 */
export const requestEphemeralKey = async (nonce: string): Promise<EphemeralKeyResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/ephemeral-key`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        client_nonce: nonce,
      }),
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

/**
 * Directly call Bridge API to reveal card details
 * This bypasses your backend and calls Bridge directly with the ephemeral key
 */
export const revealCardDetails = async (
  ephemeralKey: string,
  clientSecret: string,
  clientTimestamp: number,
): Promise<CardDetailsRevealResponse> => {
  const url = `${EXPO_PUBLIC_BRIDGE_CARD_API_BASE_URL}/v0/card_details/?secret=${encodeURIComponent(clientSecret)}&timestamp=${clientTimestamp}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw response;

  return response.json();
};

/**
 * Complete card details reveal flow
 * This combines all operations into a single function for convenience
 */
export const revealCardDetailsComplete = async (): Promise<CardDetailsRevealResponse> => {
  // Generate client nonce data
  const nonceData = await generateClientNonceData();

  // Request ephemeral key from your backend
  const ephemeralKeyResponse = await requestEphemeralKey(nonceData.nonce);

  // Directly call Bridge to reveal card details
  const cardDetails = await revealCardDetails(
    ephemeralKeyResponse.ephemeral_key,
    nonceData.clientSecret,
    nonceData.clientTimestamp,
  );

  return cardDetails;
};

// Stargate API for bridging
export const getStargateQuote = async (
  params: StargateQuoteParams,
): Promise<StargateQuoteResponse> => {
  const searchParams = new URLSearchParams(params as unknown as Record<string, string>);

  const response = await fetch(`https://stargate.finance/api/v1/quotes?${searchParams}`);

  if (!response.ok) {
    throw new Error(`Stargate API error: ${response.statusText}`);
  }

  return response.json();
};

export const fetchAPYs = async () => {
  const response = await axios.get<APYs>(
    `${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/bigquery-metrics/apys`,
  );
  return response.data;
};

export const fetchActivityEvent = async (clientTxId: string): Promise<ActivityEvent> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/activity/${clientTxId}`,
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

// Direct Deposit Session API
export const createDirectDepositSession = async (
  chainId: number,
): Promise<DirectDepositSessionResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/deposit/direct-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ chainId }),
    },
  );

  if (!response.ok) throw response;

  return response.json();
};

export const getDirectDepositSession = async (
  sessionId: string,
): Promise<DirectDepositSessionResponse> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/deposit/direct-session/${sessionId}`,
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

export const deleteDirectDepositSession = async (
  sessionId: string,
): Promise<{ success: boolean; message: string }> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/deposit/direct-session/${sessionId}`,
    {
      method: 'DELETE',
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

export const searchCoin = async (query: string) => {
  const response = await axios.get<SearchCoin>(
    `https://pro-api.coingecko.com/api/v3/search?query=${query}`,
    {
      headers: {
        'x-cg-pro-api-key': EXPO_PUBLIC_COINGECKO_API_KEY,
      },
    },
  );
  return response.data;
};

export const fetchCoinHistoricalChart = async (coinId: string, days: string = '1') => {
  const response = await axios.get<CoinHistoricalChart>(
    `https://pro-api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
    {
      headers: {
        'x-cg-pro-api-key': EXPO_PUBLIC_COINGECKO_API_KEY,
      },
    },
  );
  return response.data;
};

export const fetchHistoricalAPY = async (days: string = '30') => {
  const response = await axios.get<ChartPayload[]>(
    `${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/bigquery-metrics/historical-apy?days=${days}`,
  );
  return response.data;
};

export const startPasskeyRecovery = async (username: string, targetPublicKey: string) => {
  const response = await axios.post(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/init-user-email-recovery`,
    {
      username,
      targetPublicKey,
    },
  );
  return response.data;
};

export const fetchTokenList = async (params: SwapTokenRequest) => {
  const response = await axios.get<SwapTokenResponse[]>(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/swap-tokens`,
    {
      params,
    },
  );
  return response.data;
};

export const getDepositBonusConfig = async (): Promise<DepositBonusConfig> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/app-config/deposit-bonus`,
    {
      credentials: 'include',
      headers: {
        ...getPlatformHeaders(),
      },
    },
  );

  if (!response.ok) throw response;

  return response.json();
};
