import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL } from '@/lib/config';
import { GiveawayWinner, SpinResult, SpinStatus, SpinWinGiveaway } from '@/lib/types/spin-win';

export const fetchSpinStatus = async (): Promise<SpinStatus> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/spin-win/status`,
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

export const performSpin = async (): Promise<SpinResult> => {
  const jwt = getJWTToken();

  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/spin-win/spin`,
    {
      method: 'POST',
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

export const fetchCurrentGiveaway = async (): Promise<SpinWinGiveaway> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/spin-win/giveaway`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;
  return response.json();
};

export const fetchGiveawayWinners = async (): Promise<GiveawayWinner[]> => {
  const response = await fetch(
    `${EXPO_PUBLIC_FLASH_REWARDS_API_BASE_URL}/rewards/v1/spin-win/giveaway/winners`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getPlatformHeaders(),
      },
      credentials: 'include',
    },
  );

  if (!response.ok) throw response;
  return response.json();
};
