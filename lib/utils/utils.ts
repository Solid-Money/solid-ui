import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ClassValue, clsx } from 'clsx';
import { formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { Address, keccak256, toHex, zeroAddress } from 'viem';

import { getUsdcAddress } from '@/constants/bridge';
import { refreshToken, setAuthPreflight } from '@/lib/api';
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

/** Format a balance behind `symbol`; show "<$0.01" when amount is positive but less than 0.01 */
export function formatBalance(value: number, symbol = '$', decimals = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return `${symbol}0.00`;
  if (num < 0.01) return `<${symbol}0.01`;
  return `${symbol}${formatNumber(num, decimals)}`;
}

/** Format USD balance; show "<$0.01" when amount is positive but less than 0.01 */
export function formatBalanceUSD(value: number, decimals = 2): string {
  return formatBalance(value, '$', decimals);
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
    // On web the browser keeps the cookies the response sets.
    const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
    // Read in the same tick as refreshToken() reads the token it sends.
    const sender = isNative ? refreshingAccount() : null;
    refreshTokenPromise = refreshToken()
      .then(async response => {
        const data: { tokens: AuthTokens } = await response.json();
        // Save before the in-flight promise is cleared. A refresh that starts in
        // between would otherwise send the refresh token the server has just
        // retired, which it treats as reuse and answers by revoking the session.
        if (isNative && data.tokens) {
          saveNewTokens(data.tokens, sender);
          learnClockSkew(data.tokens.accessToken);
        }
        return data.tokens;
      })
      .finally(() => {
        refreshTokenPromise = null;
      });
  } else {
    console.warn('[TokenRefresh] Reusing in-flight token refresh');
  }

  try {
    await refreshTokenPromise;
  } catch (error) {
    // Callers sharing one in-flight refresh all land here; count the 429 once.
    if (isHTTPError(error, 429) && Date.now() >= refreshBlockedUntil) {
      noteRefreshRateLimited(error);
    }
    throw error;
  }
  refreshRateLimitStrikes = 0;
};

// Refresh this long before expiry, so a request isn't sent with a token that
// lapses on its way to the server.
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;
// A request waits at most this long for a refresh before going ahead without it.
const REFRESH_PREFLIGHT_TIMEOUT_MS = 8_000;
// And a proactive refresh happens at most this often, whatever the token says.
const MIN_PROACTIVE_REFRESH_INTERVAL_MS = 30_000;

/** Reads a JWT's payload. Decodes only; verifies nothing. */
const readJwtPayload = (token: string): { exp?: unknown; iat?: unknown } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as { exp?: unknown; iat?: unknown };
  } catch {
    return null;
  }
};

const secondsToMs = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value * 1000 : null;

/** A JWT's `exp` in ms, or null when it can't be read. Decodes only; verifies nothing. */
export const getJwtExpiryMs = (token: string): number | null =>
  secondsToMs(readJwtPayload(token)?.exp);

// How far the device clock is ahead of the server's, read off the `iat` of a
// token the moment it arrives. Expiry is judged on the server's clock: a phone
// set an hour fast would otherwise find every new token already expired and
// refresh before every request.
let clockSkewMs = 0;
const CLOCK_SKEW_IGNORED_BELOW_MS = 5 * 60_000;

const learnClockSkew = (accessToken: string) => {
  const issuedAt = secondsToMs(readJwtPayload(accessToken)?.iat);
  if (issuedAt === null) return;
  const skew = Date.now() - issuedAt;
  clockSkewMs = Math.abs(skew) < CLOCK_SKEW_IGNORED_BELOW_MS ? 0 : skew;
};

let lastProactiveRefreshAt = 0;

/**
 * Refresh the session first when the stored access token has expired or is
 * about to. The access token lasts an hour, so most launches start with an
 * expired one: without this every request of the first burst fails with 401,
 * waits for one shared refresh, and is sent again.
 *
 * Native only, where the token is ours to read; on web it is an httpOnly
 * cookie. Joins a refresh already in flight, and waits for it at most
 * {@link REFRESH_PREFLIGHT_TIMEOUT_MS}. Never throws: when the refresh fails
 * or is slow, the request goes ahead and `withRefreshToken`'s 401 handling
 * decides what happens, exactly as before.
 */
export const ensureFreshAccessToken = async (): Promise<void> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (isLoggingOut || Date.now() < refreshBlockedUntil) return;

  const tokens = useUserStore.getState().users.find(user => user.selected)?.tokens;
  if (!tokens?.accessToken || !tokens.refreshToken) return;

  const expiresAt = getJwtExpiryMs(tokens.accessToken);
  const serverNow = Date.now() - clockSkewMs;
  if (expiresAt === null || expiresAt - serverNow > ACCESS_TOKEN_REFRESH_MARGIN_MS) return;

  // Join a refresh that is already running; otherwise start one at most this often.
  if (!refreshTokenPromise) {
    if (Date.now() - lastProactiveRefreshAt < MIN_PROACTIVE_REFRESH_INTERVAL_MS) return;
    lastProactiveRefreshAt = Date.now();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    refreshSessionTokens().catch(() => {
      // Left to the 401 path.
    }),
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, REFRESH_PREFLIGHT_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
};

// Axios requests to the Solid APIs renew an expired session the same way. Set
// from here because lib/api.ts can't import this module (this one imports it).
// Optional call: test suites that mock lib/api don't provide it.
setAuthPreflight?.(ensureFreshAccessToken);

export const withRefreshToken = async <T>(
  apiCall: () => Promise<T>,
  { onError }: { onError?: () => void } = {},
): Promise<T> => {
  await ensureFreshAccessToken();
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

type RefreshingAccount = { userId: string; refreshToken: string | null };

/** The selected account and the refresh token a refresh started now sends for it. */
const refreshingAccount = (): RefreshingAccount | null => {
  const user = useUserStore.getState().users.find((user: User) => user.selected);
  return user ? { userId: user.userId, refreshToken: user.tokens?.refreshToken ?? null } : null;
};

/**
 * Saves a refresh's tokens to the account that sent it, which is no longer the
 * selected one if the user switched accounts while it was in flight. Drops them
 * when that account has since signed out or signed in again: it no longer holds
 * the refresh token this one replaced.
 */
function saveNewTokens(tokens: AuthTokens, sender: RefreshingAccount | null) {
  if (!sender || !tokens.accessToken) return;

  const { users, updateUser } = useUserStore.getState();
  const account = users.find((user: User) => user.userId === sender.userId);
  if (!account || (account.tokens?.refreshToken ?? null) !== sender.refreshToken) return;

  updateUser({
    ...account,
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
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

/** soUSD on Base, where withdrawals bridge to once the vault moved off Ethereum. */
export const isSoUSDBase = (contractAddress: string): boolean => {
  if (!contractAddress || ADDRESSES.base.vault === zeroAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.base.vault.toLowerCase();
};

export const isSoUSDToken = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return (
    isSoUSDEthereum(contractAddress) || isSoUSDFuse(contractAddress) || isSoUSDBase(contractAddress)
  );
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

/**
 * soEURC, the EUR vault's share token on Base. Recognised in every build — the
 * vault itself is listed on QA/preview only, but a soEURC balance must never be
 * read as an ordinary wallet token wherever it turns up.
 */
export const isSoEURCToken = (contractAddress: string): boolean => {
  if (!contractAddress) return false;
  return contractAddress.toLowerCase() === ADDRESSES.base.soEurcVault.toLowerCase();
};

/**
 * Vault tokens excluded from the home WalletCard total (soUSD + soFUSE + soETH +
 * soEURC). The USD shares are counted by Savings instead, so including them would
 * count them twice; soEURC is held in EUR and never enters a USD total at all.
 */
export const isWalletCardExcludedToken = (contractAddress: string): boolean => {
  return (
    isSoUSDToken(contractAddress) ||
    isSoFUSEToken(contractAddress) ||
    isSoETHToken(contractAddress) ||
    isSoEURCToken(contractAddress)
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
  canReplaceClosedCard,
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
