import { type ClassValue, clsx } from 'clsx';
import { Platform } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { Address, keccak256, toHex } from 'viem';

import { refreshToken } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { AuthTokens, User } from '@/lib/types';
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

export function compactNumberFormat(number: number) {
  return new Intl.NumberFormat('en-us', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatNumber(number: number, maximumFractionDigits = 6) {
  return new Intl.NumberFormat('en-us', {
    maximumFractionDigits,
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

export const withRefreshToken = async <T>(
  apiCall: () => Promise<T>,
  { onError }: { onError?: () => void } = {},
): Promise<T | undefined> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (
      (error?.status !== undefined && error?.status !== 401) ||
      (error?.statusCode !== undefined && error?.statusCode !== 401)
    ) {
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

      // Retry original request with new access token
      return await apiCall();
    } catch (refreshTokenError) {
      console.error(refreshTokenError);
      if (onError) {
        onError();
      } else {
        globalLogoutHandler?.();
      }
    }
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
  return contractAddress.toLowerCase() === ADDRESSES.ethereum.vault.toLowerCase();
};

export const isSoUSDFuse = (contractAddress: string): boolean => {
  return contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase();
};

export const isSoUSDToken = (contractAddress: string): boolean => {
  return isSoUSDEthereum(contractAddress) || isSoUSDFuse(contractAddress);
};

// see: https://www.nativewind.dev/docs/core-concepts/differences#rem-sizing
export const remToPx = Platform.OS === 'web' ? 16 : 14;

export const fontSize = (rem: number) => {
  return rem * remToPx;
};

// see: https://github.com/peterferguson/react-native-passkeys/blob/bff6158dca29382b2068213502adc8f0bf7f253a/src/ReactNativePasskeysModule.web.ts#L28
export const isPasskeySupported = () => {
  return (
    window?.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === 'function'
  );
};
