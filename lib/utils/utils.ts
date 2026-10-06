import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ClassValue, clsx } from 'clsx';
import { formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { Address, keccak256, toHex } from 'viem';

import { getUsdcAddress } from '@/constants/bridge';
import { refreshToken } from '@/lib/api';
import {
  ADDRESSES,
  EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
  EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_ADDRESS,
  EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_SYMBOL,
} from '@/lib/config';
import { AuthTokens, CardProvider, CardResponse, RainContractResponseDto, User } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

export const IS_SERVER = typeof window === 'undefined';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eclipseAddress(address: Address | string, start = 6, end = 4) {
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
  const num = Number(number);
  if (!Number.isFinite(num)) return '0';
  const safeMax = Number.isFinite(maximumFractionDigits) ? maximumFractionDigits : 0;
  const safeMin = Number.isFinite(minimumFractionDigits) ? minimumFractionDigits : 0;
  const resolvedMin = num >= 1 ? safeMin : 0;
  const clampedMax = Math.max(0, Math.min(20, safeMax));
  const clampedMin = Math.min(Math.max(0, resolvedMin), clampedMax);

  return new Intl.NumberFormat('en-us', {
    maximumFractionDigits: clampedMax,
    minimumFractionDigits: clampedMin,
  }).format(num);
}

/**
 * Format a USD amount with no cents (e.g. "$450") — the rewards sheets quote
 * caps and totals in whole dollars.
 */
export function formatWholeDollars(value: number): string {
  return `$${formatNumber(value || 0, 0, 0)}`;
}

/** Format cents to dollars string (e.g. for Rain card balance) */
export function formatCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Format USD balance; show "<$0.01" when amount is positive but less than 0.01 */
export function formatBalanceUSD(value: number, decimals = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return `$0.00`;
  if (num < 0.01) return '<$0.01';
  return `$${formatNumber(num, decimals)}`;
}

export function formatUSD(number: number) {
  return new Intl.NumberFormat('en-us', {
    style: 'currency',
    currency: 'USD',
  }).format(number);
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

let globalLogoutHandler: (() => void) | null = null;

let refreshTokenPromise: Promise<AuthTokens | null> | null = null;

// refresh-token is throttled at 10/min per IP. Once it answers 429, retrying on
// every 401 keeps the client locked out indefinitely, so hold off refreshing
// until the window has passed, doubling the wait on each consecutive 429.
const REFRESH_BACKOFF_BASE_MS = 60_000;
const REFRESH_BACKOFF_MAX_MS = 5 * 60_000;
let refreshBlockedUntil = 0;
let refreshRateLimitStrikes = 0;

// Seconds from a Retry-After header. On web it is only readable if CORS exposes
// it, so a missing header falls back to the backoff schedule.
const getRetryAfterMs = (error: any): number | null => {
  const value = error?.headers?.get?.('Retry-After');
  const seconds = Number(value);
  return value && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
};

const noteRefreshRateLimited = (error: any) => {
  refreshRateLimitStrikes += 1;
  const backoff = Math.min(
    REFRESH_BACKOFF_BASE_MS * 2 ** (refreshRateLimitStrikes - 1),
    REFRESH_BACKOFF_MAX_MS,
  );
  refreshBlockedUntil = Date.now() + Math.max(backoff, getRetryAfterMs(error) ?? 0);
};

// Flag to suppress session-expired handler during intentional logout
let isLoggingOut = false;

export const setIsLoggingOut = (value: boolean) => {
  isLoggingOut = value;
};

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

/**
 * Refresh the session now, joining a refresh already in flight rather than
 * starting a second one — two refreshes racing with the same refresh token is
 * how a rotated token gets rejected. Saves the new tokens on native; on web the
 * browser keeps the cookies the response sets.
 *
 * Throws whatever the refresh endpoint threw, and leaves deciding what that
 * means (logging out, retrying later) to the caller.
 */
export const refreshSessionTokens = async (): Promise<void> => {
  // Still inside a 429 backoff: don't hit refresh-token again yet.
  if (Date.now() < refreshBlockedUntil) {
    throw new Error('Session refresh is rate limited');
  }

  // Use existing refresh token promise if one is in progress
  const isNewRefresh = !refreshTokenPromise;
  if (isNewRefresh) {
    refreshTokenPromise = refreshToken()
      .then(async response => {
        const data: { tokens: AuthTokens } = await response.json();
        return data.tokens;
      })
      .finally(() => {
        refreshTokenPromise = null;
      });
  } else {
    console.warn('[TokenRefresh] Reusing in-flight token refresh');
  }

  let tokens: AuthTokens | null = null;
  try {
    tokens = await refreshTokenPromise;
  } catch (error) {
    // Callers sharing one in-flight refresh all land here; count the 429 once.
    if (isHTTPError(error, 429) && Date.now() >= refreshBlockedUntil) {
      noteRefreshRateLimited(error);
    }
    throw error;
  }
  refreshRateLimitStrikes = 0;

  // Only save new tokens on mobile platforms
  // On web, we don't need to save new tokens
  // because the browser will handle it
  if ((Platform.OS === 'ios' || Platform.OS === 'android') && tokens) {
    saveNewTokens(tokens);
  }
};

export const withRefreshToken = async <T>(
  apiCall: () => Promise<T>,
  { onError }: { onError?: () => void } = {},
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    // A superseded request (react-query aborts the previous one when the query
    // key changes) is expected control flow, not a failure to log.
    if (error?.name === 'AbortError') {
      throw error;
    }

    if (!isHTTPError(error, 401)) {
      console.error(error);
      throw error;
    }

    // Still inside a 429 backoff: surface the 401 without hitting refresh-token.
    if (Date.now() < refreshBlockedUntil) {
      throw error;
    }

    try {
      await refreshSessionTokens();
    } catch (refreshTokenError) {
      if (onError) {
        onError();
      } else if (
        !isLoggingOut &&
        // 404: the backend has no refresh token for this user (logged out
        // elsewhere or rotated away), so the session can never be revived.
        isAnyHTTPError(refreshTokenError, [401, 403, 404, 500])
      ) {
        globalLogoutHandler?.();
      }
      throw refreshTokenError;
    }

    // Retry original request with new access token
    return await apiCall();
  }
};

function saveNewTokens(tokens: AuthTokens) {
  const { users, updateUser } = useUserStore.getState();
  const currentUser = users.find((user: User) => user.selected);

  if (!currentUser) throw new Error('No current user found');

  if (tokens.accessToken) {
    updateUser({
      ...currentUser,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
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

export const isSoFUSEToken = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.fuse.fuseVault.toLowerCase();
};

export const isSoUSDToken = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return isSoUSDEthereum(contractAddress) || isSoUSDFuse(contractAddress);
};

export const isSoETHEthereum = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.ethereum.soEthVault.toLowerCase();
};

export const isSoETHFuse = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.fuse.soEthVault.toLowerCase();
};

export const isSoETHToken = (contractAddress: string): boolean => {
  return isSoETHEthereum(contractAddress) || isSoETHFuse(contractAddress);
};

/** Vault tokens excluded from home WalletCard total (soUSD + soFUSE + soETH) to avoid double count with savings. */
export const isWalletCardExcludedToken = (contractAddress: string): boolean => {
  return (
    isSoUSDToken(contractAddress) || isSoFUSEToken(contractAddress) || isSoETHToken(contractAddress)
  );
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

export const getArbitrumFundingAddress = (cardDetails: CardResponse) => {
  const ARBITRUM_CHAIN = 'arbitrum';

  if (
    cardDetails?.funding_instructions?.chain === ARBITRUM_CHAIN &&
    cardDetails?.funding_instructions?.address
  ) {
    return cardDetails.funding_instructions.address;
  }

  return cardDetails?.additional_funding_instructions?.find(
    instruction => instruction.chain === ARBITRUM_CHAIN && instruction.address,
  )?.address;
};

/** Card deposit token address on the funding chain: use override (e.g. rUSD) when set for funding chain, else USDC. */
export function getCardDepositTokenAddress(chainId: number): string {
  if (
    chainId === EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID &&
    EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_ADDRESS
  ) {
    return EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_ADDRESS;
  }
  return getUsdcAddress(chainId);
}

/** Display symbol for card deposit token (e.g. 'rUSD' in Rain sandbox, 'USDC' otherwise). */
export function getCardDepositTokenSymbol(provider: CardProvider | null | undefined): string {
  if (provider === CardProvider.RAIN && EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_ADDRESS) {
    return EXPO_PUBLIC_RAIN_CARD_DEPOSIT_TOKEN_SYMBOL;
  }
  return 'USDC';
}

/** Decimals for card deposit/withdraw token (e.g. rUSD, USDC). */
export const CARD_DEPOSIT_TOKEN_DECIMALS = 6;

/** Resolve card funding address: Rain from contracts API (EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID), Bridge from card details. */
export function getCardFundingAddress(
  cardDetails: CardResponse | null | undefined,
  provider: CardProvider | null | undefined,
  contracts: RainContractResponseDto[] | null | undefined,
): string | undefined {
  if (provider === CardProvider.RAIN) {
    if (!contracts?.length) return undefined;
    const rainContract = contracts.find(
      c => Number(c.chainId) === EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
    );
    return rainContract?.depositAddress || undefined;
  }
  return cardDetails ? getArbitrumFundingAddress(cardDetails) : undefined;
}

// Card-flow routing predicates live in their own leaf module so they are unit
// testable (this file's import graph does not load under jest-expo). Re-exported
// here so `@/lib/utils` stays the single import path for consumers.
export {
  getActiveCardRoute,
  hasCard,
  hasCardStatusWithRainApplication,
  hasPendingCard,
} from '@/lib/utils/cardStatusRouting';

// The minimum-deposit gate predicates live in their own leaf module for the
// same reason as the routing ones above: they are load-bearing and this file's
// import graph does not load under jest-expo. Re-exported so `@/lib/utils`
// stays the single import path.
export {
  hasMetCardDeposit,
  hasMetSavingsDeposit,
  requiresCardDeposit,
} from '@/lib/utils/cardDepositGate';
