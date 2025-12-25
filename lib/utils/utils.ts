import { type ClassValue, clsx } from 'clsx';
import { formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { Platform } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { Address, keccak256, toHex } from 'viem';

import { refreshToken } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { AuthTokens, CardResponse, CardStatus, CardStatusResponse, User } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const IS_SERVER = typeof window === 'undefined';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eclipseAddress(address: Address, start = 6, end = 4) {
  return address.slice(0, start) + '...' + address.slice(-end);
}

export function eclipseUsername(username: string, start = 10) {
  return username.slice(0, start) + (username.length > start ? '...' : '');
}

/**
 * Gets the display name for a user, preferring email for email-first users.
 * Falls back to username if no email exists (legacy users).
 * Auto-generated usernames (starting with 'user_') indicate email-first signup.
 */
export function getUserDisplayName(user: User | null | undefined, maxLength = 20): string {
  if (!user) {
    return 'Unknown';
  }
  // Otherwise show username (legacy users or users who set a username)
  return eclipseUsername(user.username || user.email || 'Unknown', maxLength);
}

/**
 * Truncates an email address for display purposes.
 * Shows the local part (before @) truncated if needed, plus the domain.
 */
export function eclipseEmail(email: string, maxLength = 20): string {
  if (email.length <= maxLength) return email;

  const [localPart, domain] = email.split('@');
  if (!domain) return email.slice(0, maxLength) + '...';

  // Calculate how much space we have for the local part
  const domainWithAt = '@' + domain;
  const availableForLocal = maxLength - domainWithAt.length - 3; // -3 for '...'

  if (availableForLocal <= 3) {
    // Domain too long, just truncate the whole thing
    return email.slice(0, maxLength - 3) + '...';
  }

  return localPart.slice(0, availableForLocal) + '...' + domainWithAt;
}

export function compactNumberFormat(number: number) {
  return new Intl.NumberFormat('en-us', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatNumber(number: number, maximumFractionDigits = 6, minimumFractionDigits = 2) {
  return new Intl.NumberFormat('en-us', {
    maximumFractionDigits,
    minimumFractionDigits: number >= 1 ? minimumFractionDigits : 0,
  }).format(number);
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

let globalLogoutHandler: (() => void) | null = null;

let refreshTokenPromise: Promise<Response> | null = null;

export const setGlobalLogoutHandler = (handler: () => void) => {
  globalLogoutHandler = handler;
};

export const isHTTPError = (error: any, status: number) => {
  return (
    (error?.status !== undefined && error?.status === status) ||
    (error?.statusCode !== undefined && error?.statusCode === status)
  );
};

export const isAnyHTTPError = (error: any, statuses: number[]) => {
  return statuses.some(status => isHTTPError(error, status));
};

export const withRefreshToken = async <T>(
  apiCall: () => Promise<T>,
  { onError }: { onError?: () => void } = {},
): Promise<T | undefined> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (!isHTTPError(error, 401)) {
      console.error(error);
      throw error;
    }

    try {
      // Use existing refresh token promise if one is in progress
      if (!refreshTokenPromise) {
        refreshTokenPromise = refreshToken().finally(() => {
          refreshTokenPromise = null;
        });
      }

      const refreshResponse = await refreshTokenPromise;

      // Only save new tokens on mobile platforms
      // On web, we don't need to save new tokens
      // because the browser will handle it
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await saveNewTokens(refreshResponse);
      }
    } catch (refreshTokenError) {
      console.error(refreshTokenError);
      if (onError) {
        onError();
      } else if (isAnyHTTPError(refreshTokenError, [401, 403, 404, 500])) {
        globalLogoutHandler?.();
      }
    }

    // Retry original request with new access token
    return await apiCall();
  }
};

async function saveNewTokens(refreshResponse: Response) {
  const refreshTokenResponse: { tokens: AuthTokens } = await refreshResponse.json();

  const newTokens = refreshTokenResponse.tokens;

  // Update stored tokens
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { users, updateUser } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);

    if (!currentUser) throw new Error('No current user found');

    if (newTokens.accessToken) {
      updateUser({
        ...currentUser,
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
      });
    }
  }
}

export const getNonce = async ({ appId }: { appId: string }): Promise<bigint> => {
  const accountNonce = await AsyncStorage.getItem('accountNonce');
  const nonce = parseInt(accountNonce || '0');
  const encodedNonce = keccak256(toHex(appId + nonce.toString()));
  return BigInt(encodedNonce);
};

export const isSoUSDEthereum = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.ethereum.vault.toLowerCase();
};

export const isSoUSDFuse = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase();
};

export const isSoUSDToken = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return isSoUSDEthereum(contractAddress) || isSoUSDFuse(contractAddress);
};

export const isUSDCEthereum = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.ethereum.usdc.toLowerCase();
};

// see: https://www.nativewind.dev/docs/core-concepts/differences#rem-sizing
export const remToPx = Platform.OS === 'web' ? 16 : 14;

export const fontSize = (rem: number) => {
  return rem * remToPx;
};

export const toTitleCase = (word: string) => {
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export const safeStringify = (value: any) => {
  try {
    return JSON.stringify(value, (_, value) =>
      typeof value === 'bigint' ? value.toString() : (value as unknown),
    );
  } catch (error) {
    console.error('Error stringifying value:', error);
    return value;
  }
};

export const safeParse = (value: any) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Error parsing value:', error);
    return value;
  }
};

export const sanitize = (data: Record<string, any>) => {
  try {
    return Object.entries(data)
      .filter(([_, value]) => value !== undefined && value !== null)
      .reduce(
        (acc, [key, value]) => {
          acc[key] = safeParse(safeStringify(value));
          return acc;
        },
        {} as Record<string, any>,
      );
  } catch (error) {
    console.error('Error sanitizing data:', error);
    return data;
  }
};

export const oneMinute = 60 * 1000;

export const formatTimeRemaining = (milliseconds: number): string => {
  const futureDate = new Date(Date.now() + milliseconds);
  return formatDistanceToNow(futureDate, { addSuffix: true });
};

export const isTransactionStuck = (timestamp: string): boolean => {
  const transactionDate = new Date(parseInt(timestamp) * 1000);
  const oneDayAgo = subDays(new Date(), 1);
  return isBefore(transactionDate, oneDayAgo);
};

// Convert base64url string to Uint8Array for WebAuthn API
export const base64urlToUint8Array = (base64url: string): Uint8Array => {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Decode base64 string to binary string
  const binaryString = atob(base64);
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const parseStampHeaderValueCredentialId = (stampHeaderValue: string) => {
  return JSON.parse(stampHeaderValue).credentialId;
};

export const getArbitrumFundingAddress = (cardDetails: CardResponse) => {
  const ARBITRUM_CHAIN = "arbitrum"

  if (cardDetails?.funding_instructions?.chain === ARBITRUM_CHAIN) {
    return cardDetails?.funding_instructions?.address;
  }

  return cardDetails?.additional_funding_instructions?.find(
    instruction => instruction.chain === ARBITRUM_CHAIN,
  )?.address;
};

export const hasCard = (cardStatus: CardStatusResponse | null | undefined): boolean => {
  return cardStatus?.status === CardStatus.ACTIVE || cardStatus?.status === CardStatus.FROZEN;
};
